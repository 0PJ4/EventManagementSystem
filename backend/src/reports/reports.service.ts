import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  /**
   * a. Find all users who are double-booked
   * Users are double-booked if they have attendance records for overlapping events
   */
  async findDoubleBookedUsers(): Promise<any[]> {
    const query = `
      SELECT DISTINCT
        u.id as user_id,
        u.email,
        u.name,
        a1."eventId" as event1_id,
        e1.title as event1_title,
        e1."startTime" as event1_start,
        e1."endTime" as event1_end,
        a2."eventId" as event2_id,
        e2.title as event2_title,
        e2."startTime" as event2_start,
        e2."endTime" as event2_end
      FROM attendances a1
      INNER JOIN attendances a2 ON a1."userId" = a2."userId" AND a1."eventId" < a2."eventId"
      INNER JOIN events e1 ON a1."eventId" = e1.id
      INNER JOIN events e2 ON a2."eventId" = e2.id
      INNER JOIN users u ON a1."userId" = u.id
      WHERE a1."userId" IS NOT NULL
        AND (e1."startTime" < e2."endTime" AND e1."endTime" > e2."startTime")
      ORDER BY u.email, e1."startTime";
    `;

    return this.dataSource.query(query);
  }

  /**
   * b. List all events that violate resource constraints
   */
  async findEventsWithViolatedConstraints(): Promise<any[]> {
    const query = `
      WITH resource_violations AS (
        -- Exclusive resources double-booked
        SELECT 
          ra1."eventId" as event_id,
          ra1."resourceId" as resource_id,
          r.name as resource_name,
          'EXCLUSIVE_DOUBLE_BOOKED' as violation_type,
          e1.title as event_title,
          e1."startTime" as start_time,
          e1."endTime" as end_time
        FROM resource_allocations ra1
        INNER JOIN resource_allocations ra2 
          ON ra1."resourceId" = ra2."resourceId" 
          AND ra1."eventId" < ra2."eventId"
        INNER JOIN resources r ON ra1."resourceId" = r.id
        INNER JOIN events e1 ON ra1."eventId" = e1.id
        INNER JOIN events e2 ON ra2."eventId" = e2.id
        WHERE r.type = 'exclusive'
          AND (e1."startTime" < e2."endTime" AND e1."endTime" > e2."startTime")
        
        UNION ALL
        
        -- Shareable resources over-allocated
        SELECT 
          ra."eventId" as event_id,
          ra."resourceId" as resource_id,
          r.name as resource_name,
          'SHAREABLE_OVER_ALLOCATED' as violation_type,
          e.title as event_title,
          e."startTime" as start_time,
          e."endTime" as end_time
        FROM resource_allocations ra
        INNER JOIN resources r ON ra."resourceId" = r.id
        INNER JOIN events e ON ra."eventId" = e.id
        WHERE r.type = 'shareable'
          AND r."maxConcurrentUsage" IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM resource_allocations ra2
            INNER JOIN events e2 ON ra2."eventId" = e2.id
            WHERE ra2."resourceId" = ra."resourceId"
              AND (e2."startTime" < e."endTime" AND e2."endTime" > e."startTime")
            GROUP BY ra2."resourceId"
            HAVING COALESCE(SUM(ra2.quantity), 0) > r."maxConcurrentUsage"
          )
        
        UNION ALL
        
        -- Consumables exceeding available quantity
        SELECT 
          ra."eventId" as event_id,
          ra."resourceId" as resource_id,
          r.name as resource_name,
          'CONSUMABLE_EXCEEDED' as violation_type,
          e.title as event_title,
          e."startTime" as start_time,
          e."endTime" as end_time
        FROM resource_allocations ra
        INNER JOIN resources r ON ra."resourceId" = r.id
        INNER JOIN events e ON ra."eventId" = e.id
        WHERE r.type = 'consumable'
          AND EXISTS (
            SELECT 1
            FROM resource_allocations ra2
            WHERE ra2."resourceId" = ra."resourceId"
              AND ra2."eventId" = ra."eventId"
            GROUP BY ra2."resourceId", ra2."eventId"
            HAVING COALESCE(SUM(ra2.quantity), 0) > r."availableQuantity"
          )
      )
      SELECT * FROM resource_violations
      ORDER BY start_time, resource_name;
    `;

    return this.dataSource.query(query);
  }

  /**
   * c. Compute resource utilization per organization
   */
  async getResourceUtilizationPerOrganization(organizationId?: string): Promise<any[]> {
    let orgFilter = '';
    if (organizationId) {
      orgFilter = `WHERE o.id = $1`;
    }

    const query = `
      WITH resource_hours AS (
        SELECT 
          r.id as resource_id,
          SUM(EXTRACT(EPOCH FROM (e."endTime" - e."startTime")) / 3600) as total_hours
        FROM resources r
        INNER JOIN resource_allocations ra ON ra."resourceId" = r.id
        INNER JOIN events e ON ra."eventId" = e.id
        GROUP BY r.id
      ),
      resource_peak_usage AS (
        SELECT 
          r.id as resource_id,
          MAX(timepoint_concurrent.total) as peak_concurrent
        FROM resources r
        INNER JOIN resource_allocations ra ON ra."resourceId" = r.id
        INNER JOIN events e ON ra."eventId" = e.id
        CROSS JOIN LATERAL (
          SELECT 
            SUM(ra2.quantity) as total
          FROM resource_allocations ra2
          INNER JOIN events e2 ON ra2."eventId" = e2.id
          WHERE ra2."resourceId" = r.id
            AND (e2."startTime" <= e."startTime" AND e2."endTime" > e."startTime")
        ) timepoint_concurrent
        GROUP BY r.id
      )
      SELECT 
        o.id as organization_id,
        o.name as organization_name,
        r.id as resource_id,
        r.name as resource_name,
        r.type as resource_type,
        COALESCE(rh.total_hours, 0) as total_hours_used,
        COALESCE(rpu.peak_concurrent, 0) as peak_concurrent_usage,
        r."availableQuantity" as available_quantity,
        CASE 
          WHEN r.type = 'shareable' AND r."maxConcurrentUsage" IS NOT NULL 
          THEN r."maxConcurrentUsage" 
          ELSE r."availableQuantity" 
        END as max_capacity,
        CASE 
          WHEN COALESCE(rh.total_hours, 0) < 10 
          THEN true 
          ELSE false 
        END as is_underutilized
      FROM organizations o
      LEFT JOIN resources r ON r."organizationId" = o.id
      LEFT JOIN resource_hours rh ON rh.resource_id = r.id
      LEFT JOIN resource_peak_usage rpu ON rpu.resource_id = r.id
      ${orgFilter}
      WHERE r.id IS NOT NULL
      ORDER BY o.name, r.name;
    `;

    if (organizationId) {
      return this.dataSource.query(query, [organizationId]);
    }
    return this.dataSource.query(query);
  }

  /**
   * d. Find parent events whose child sessions violate time boundaries
   * Uses recursive CTE to traverse parent-child relationships
   */
  async findParentEventsWithInvalidChildren(): Promise<any[]> {
    const query = `
      WITH RECURSIVE event_hierarchy AS (
        -- Base case: all events
        SELECT 
          id,
          title,
          "startTime" as start_time,
          "endTime" as end_time,
          "parentEventId" as parent_event_id,
          "organizationId" as organization_id,
          id as root_parent_id,
          0 as level
        FROM events
        WHERE "parentEventId" IS NULL
        
        UNION ALL
        
        -- Recursive case: child events
        SELECT 
          e.id,
          e.title,
          e."startTime" as start_time,
          e."endTime" as end_time,
          e."parentEventId" as parent_event_id,
          e."organizationId" as organization_id,
          eh.root_parent_id,
          eh.level + 1
        FROM events e
        INNER JOIN event_hierarchy eh ON e."parentEventId" = eh.id
      ),
      parent_child_violations AS (
        SELECT DISTINCT
          p.id as parent_id,
          p.title as parent_title,
          p.start_time as parent_start,
          p.end_time as parent_end,
          c.id as child_id,
          c.title as child_title,
          c.start_time as child_start,
          c.end_time as child_end,
          CASE 
            WHEN c.start_time < p.start_time THEN 'CHILD_STARTS_BEFORE_PARENT'
            WHEN c.end_time > p.end_time THEN 'CHILD_ENDS_AFTER_PARENT'
            ELSE 'OK'
          END as violation_type
        FROM event_hierarchy p
        INNER JOIN event_hierarchy c ON c.root_parent_id = p.id AND c.level > 0
        WHERE c.start_time < p.start_time OR c.end_time > p.end_time
      )
      SELECT * FROM parent_child_violations
      ORDER BY parent_start, child_start;
    `;

    return this.dataSource.query(query);
  }

  /**
   * e. List events with external attendees exceeding a threshold
   */
  async findEventsWithExternalAttendeesExceedingThreshold(threshold: number = 10): Promise<any[]> {
    const query = `
      SELECT 
        e.id as event_id,
        e.title,
        e."startTime" as start_time,
        e."endTime" as end_time,
        e.capacity,
        COUNT(a.id) as external_attendee_count,
        o.name as organization_name
      FROM events e
      INNER JOIN organizations o ON e."organizationId" = o.id
      LEFT JOIN attendances a ON a."eventId" = e.id AND a."userId" IS NULL
      WHERE e."allowExternalAttendees" = true
      GROUP BY e.id, e.title, e."startTime", e."endTime", e.capacity, o.name
      HAVING COUNT(a.id) >= $1
      ORDER BY external_attendee_count DESC, e."startTime";
    `;

    return this.dataSource.query(query, [threshold]);
  }

  /**
   * Helper: Refresh materialized view for resource utilization
   */
  async refreshResourceUtilizationView(): Promise<void> {
    const query = `REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS resource_utilization_summary;`;
    await this.dataSource.query(query);
  }

  /**
   * Capacity Utilization Analytics
   * Calculates percentage of event capacity filled for each event
   */
  async getCapacityUtilization(organizationId?: string): Promise<any[]> {
    let orgFilter = '';
    if (organizationId) {
      orgFilter = `WHERE e."organizationId" = $1`;
    }

    const query = `
      SELECT 
        e.id as event_id,
        e.title,
        e."startTime" as start_time,
        e."endTime" as end_time,
        e.capacity,
        COUNT(a.id) as attendance_count,
        CASE 
          WHEN e.capacity > 0 THEN ROUND((COUNT(a.id)::DECIMAL / e.capacity * 100), 2)
          ELSE 0
        END as utilization_percentage,
        o.name as organization_name,
        CASE
          WHEN e.capacity > 0 AND (COUNT(a.id)::DECIMAL / e.capacity * 100) > 100 THEN 'Over-filled'
          WHEN e.capacity > 0 AND (COUNT(a.id)::DECIMAL / e.capacity * 100) >= 80 THEN 'Well-filled'
          WHEN e.capacity > 0 AND (COUNT(a.id)::DECIMAL / e.capacity * 100) >= 50 THEN 'Moderately-filled'
          ELSE 'Under-filled'
        END as fill_status
      FROM events e
      LEFT JOIN attendances a ON a."eventId" = e.id
      LEFT JOIN organizations o ON e."organizationId" = o.id
      ${orgFilter}
      GROUP BY e.id, e.title, e."startTime", e."endTime", e.capacity, o.name
      ORDER BY utilization_percentage DESC, e."startTime" DESC;
    `;

    if (organizationId) {
      return this.dataSource.query(query, [organizationId]);
    }
    return this.dataSource.query(query);
  }

  /**
   * Show-Up Rate Analytics (Check-in vs. Registration)
   * Compares checked-in attendees vs. total registrations for each event
   */
  async getShowUpRate(organizationId?: string): Promise<any[]> {
    let orgFilter = '';
    if (organizationId) {
      orgFilter = `WHERE e."organizationId" = $1`;
    }

    const query = `
      SELECT 
        e.id as event_id,
        e.title,
        e."startTime" as start_time,
        e."endTime" as end_time,
        COUNT(a.id) as total_registrations,
        COUNT(CASE WHEN a."checkedInAt" IS NOT NULL THEN 1 END) as checked_in_count,
        CASE 
          WHEN COUNT(a.id) > 0 THEN ROUND((COUNT(CASE WHEN a."checkedInAt" IS NOT NULL THEN 1 END)::DECIMAL / COUNT(a.id) * 100), 2)
          ELSE 0
        END as show_up_rate,
        o.name as organization_name
      FROM events e
      LEFT JOIN attendances a ON a."eventId" = e.id
      LEFT JOIN organizations o ON e."organizationId" = o.id
      ${orgFilter}
      GROUP BY e.id, e.title, e."startTime", e."endTime", o.name
      HAVING COUNT(a.id) > 0
      ORDER BY show_up_rate DESC, e."startTime" DESC;
    `;

    if (organizationId) {
      return this.dataSource.query(query, [organizationId]);
    }
    return this.dataSource.query(query);
  }
}
