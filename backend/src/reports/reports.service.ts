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
  async findDoubleBookedUsers(organizationId?: string): Promise<any[]> {
    let orgFilter = '';
    if (organizationId) {
      orgFilter = `AND (e1."organizationId" = $1 OR e2."organizationId" = $1)`;
    }

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
        ${orgFilter}
      ORDER BY u.email, e1."startTime";
    `;

    if (organizationId) {
      return this.dataSource.query(query, [organizationId]);
    }
    return this.dataSource.query(query);
  }

  /**
   * b. List all events that violate resource constraints
   */
  async findEventsWithViolatedConstraints(organizationId?: string): Promise<any[]> {
    let orgFilter = '';
    if (organizationId) {
      orgFilter = `AND e1."organizationId" = $1`;
    }

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
          ${orgFilter}
        
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
          ${organizationId ? `AND e."organizationId" = $1` : ''}
          AND EXISTS (
            SELECT 1
            FROM resource_allocations ra2
            INNER JOIN events e2 ON ra2."eventId" = e2.id
            WHERE ra2."resourceId" = ra."resourceId"
              AND (e2."startTime" < e."endTime" AND e2."endTime" > e."startTime")
              ${organizationId ? `AND e2."organizationId" = $1` : ''}
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
          ${organizationId ? `AND e."organizationId" = $1` : ''}
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

    if (organizationId) {
      return this.dataSource.query(query, [organizationId]);
    }
    return this.dataSource.query(query);
  }

  /**
   * Compute resource utilization per organization
   * Uses materialized view for performance with proper error handling and data validation
   * Note: The materialized view only includes resources with organizations (INNER JOIN)
   * Global resources need to be queried separately from the resources table
   */
  async getResourceUtilizationPerOrganization(organizationId?: string): Promise<any[]> {
    // Track retry attempts to prevent infinite loops
    const MAX_RETRIES = 1;
    let retryCount = 0;
    
    const executeQuery = async (): Promise<any[]> => {
      try {
        // Validate and sanitize organizationId
        let sanitizedOrgId: string | undefined = undefined;
        if (organizationId && typeof organizationId === 'string') {
          const trimmed = organizationId.trim();
          // Basic UUID validation (UUID v4 format)
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (trimmed.length > 0 && uuidRegex.test(trimmed)) {
            sanitizedOrgId = trimmed;
          }
        }

        // Build query - First get data from materialized view (org-specific resources)
        let query: string;
        const params: any[] = [];

        // Query materialized view - column names match the view definition
        // The view has: organization_id, organization_name, resource_id, resource_name, 
        // resource_type, total_hours_used, peak_concurrent_usage, "availableQuantity", 
        // max_capacity, is_underutilized
        if (sanitizedOrgId) {
          // Query with organization filter
          query = `
            SELECT 
              rus.organization_id::text as organization_id,
              rus.organization_name::text as organization_name,
              rus.resource_id::text,
              rus.resource_name::text,
              rus.resource_type::text,
              COALESCE(CAST(rus.total_hours_used AS NUMERIC), 0)::numeric as total_hours_used,
              COALESCE(CAST(rus.peak_concurrent_usage AS NUMERIC), 0)::numeric as peak_concurrent_usage,
              COALESCE(CAST(rus."availableQuantity" AS NUMERIC), 
                       (SELECT CAST(r."availableQuantity" AS NUMERIC) FROM resources r WHERE r.id = rus.resource_id), 
                       0)::numeric as available_quantity,
              COALESCE(CAST(rus.max_capacity AS NUMERIC), 0)::numeric as max_capacity,
              COALESCE(rus.is_underutilized, false)::boolean as is_underutilized,
              -- Calculate utilization percentage
              CASE 
                WHEN COALESCE(CAST(rus.max_capacity AS NUMERIC), 0) > 0 
                THEN ROUND((COALESCE(CAST(rus.peak_concurrent_usage AS NUMERIC), 0) / CAST(rus.max_capacity AS NUMERIC) * 100), 2)
                ELSE 0
              END::numeric as utilization_percentage
            FROM resource_utilization_summary rus
            WHERE rus.organization_id = $1::uuid
            ORDER BY rus.organization_name, rus.resource_name;
          `;
          params.push(sanitizedOrgId);
        } else {
          // Query all organizations
          query = `
            SELECT 
              rus.organization_id::text as organization_id,
              rus.organization_name::text as organization_name,
              rus.resource_id::text,
              rus.resource_name::text,
              rus.resource_type::text,
              COALESCE(CAST(rus.total_hours_used AS NUMERIC), 0)::numeric as total_hours_used,
              COALESCE(CAST(rus.peak_concurrent_usage AS NUMERIC), 0)::numeric as peak_concurrent_usage,
              COALESCE(CAST(rus."availableQuantity" AS NUMERIC), 
                       (SELECT CAST(r."availableQuantity" AS NUMERIC) FROM resources r WHERE r.id = rus.resource_id), 
                       0)::numeric as available_quantity,
              COALESCE(CAST(rus.max_capacity AS NUMERIC), 0)::numeric as max_capacity,
              COALESCE(rus.is_underutilized, false)::boolean as is_underutilized,
              -- Calculate utilization percentage
              CASE 
                WHEN COALESCE(CAST(rus.max_capacity AS NUMERIC), 0) > 0 
                THEN ROUND((COALESCE(CAST(rus.peak_concurrent_usage AS NUMERIC), 0) / CAST(rus.max_capacity AS NUMERIC) * 100), 2)
                ELSE 0
              END::numeric as utilization_percentage
            FROM resource_utilization_summary rus
            ORDER BY rus.organization_name, rus.resource_name;
          `;
        }

        // Execute query with proper error handling
        const results = await this.dataSource.query(query, params);

        // Now get global resources separately (not in materialized view)
        let globalResourcesQuery = '';
        const globalParams: any[] = [];
        
        if (sanitizedOrgId || !sanitizedOrgId) {
          // For org admins: include global resources they can use
          // For admins: show all global resources
          globalResourcesQuery = `
            SELECT 
              'global'::text as organization_id,
              'Global Resources'::text as organization_name,
              r.id::text as resource_id,
              r.name::text as resource_name,
              r.type::text as resource_type,
              COALESCE(
                (SELECT SUM(EXTRACT(EPOCH FROM (e."endTime" - e."startTime")) / 3600)
                 FROM resource_allocations ra
                 INNER JOIN events e ON ra."eventId" = e.id
                 WHERE ra."resourceId" = r.id), 0
              )::numeric as total_hours_used,
              COALESCE(
                (SELECT MAX(concurrent.quantity)
                 FROM (
                   SELECT SUM(ra2.quantity) as quantity
                   FROM resource_allocations ra2
                   INNER JOIN events e2 ON ra2."eventId" = e2.id
                   WHERE ra2."resourceId" = r.id
                   GROUP BY e2."startTime"
                 ) concurrent), 0
              )::numeric as peak_concurrent_usage,
              COALESCE(CAST(r."availableQuantity" AS NUMERIC), 0)::numeric as available_quantity,
              COALESCE(CAST(
                CASE 
                  WHEN r.type = 'shareable' AND r."maxConcurrentUsage" IS NOT NULL 
                  THEN r."maxConcurrentUsage" 
                  ELSE r."availableQuantity" 
                END AS NUMERIC), 0
              )::numeric as max_capacity,
              CASE 
                WHEN COALESCE(
                  (SELECT SUM(EXTRACT(EPOCH FROM (e."endTime" - e."startTime")) / 3600)
                   FROM resource_allocations ra
                   INNER JOIN events e ON ra."eventId" = e.id
                   WHERE ra."resourceId" = r.id), 0
                ) < 10 
                THEN true 
                ELSE false 
              END as is_underutilized,
              -- Calculate utilization percentage
              CASE 
                WHEN COALESCE(CAST(
                  CASE 
                    WHEN r.type = 'shareable' AND r."maxConcurrentUsage" IS NOT NULL 
                    THEN r."maxConcurrentUsage" 
                    ELSE r."availableQuantity" 
                  END AS NUMERIC), 0) > 0 
                THEN ROUND((
                  COALESCE(
                    (SELECT MAX(concurrent.quantity)
                     FROM (
                       SELECT SUM(ra2.quantity) as quantity
                       FROM resource_allocations ra2
                       INNER JOIN events e2 ON ra2."eventId" = e2.id
                       WHERE ra2."resourceId" = r.id
                       GROUP BY e2."startTime"
                     ) concurrent), 0
                  ) / CAST(
                    CASE 
                      WHEN r.type = 'shareable' AND r."maxConcurrentUsage" IS NOT NULL 
                      THEN r."maxConcurrentUsage" 
                      ELSE r."availableQuantity" 
                    END AS NUMERIC) * 100), 2)
                ELSE 0
              END::numeric as utilization_percentage
            FROM resources r
            WHERE (r."isGlobal" = true OR r."organizationId" IS NULL)
            ORDER BY r.name;
          `;
        }

        let globalResults: any[] = [];
        if (globalResourcesQuery) {
          try {
            globalResults = await this.dataSource.query(globalResourcesQuery, globalParams);
          } catch (globalError: any) {
            // If global resources query fails, log but don't fail the whole request
            console.warn('Failed to fetch global resources:', globalError.message);
          }
        }

        // Combine and transform results
        const allResults = [...results, ...globalResults];
        
        const transformedResults = allResults.map((row: any) => {
          // Safely parse numeric values
          const totalHoursUsed = parseFloat(String(row.total_hours_used || 0));
          const peakConcurrent = parseFloat(String(row.peak_concurrent_usage || 0));
          const availableQty = parseFloat(String(row.available_quantity || 0));
          const maxCapacity = parseFloat(String(row.max_capacity || 0));
          const utilizationPct = parseFloat(String(row.utilization_percentage || 0));
          
          return {
            organization_id: row.organization_id ? String(row.organization_id) : 'global',
            organization_name: String(row.organization_name || 'Unknown'),
            resource_id: String(row.resource_id || ''),
            resource_name: String(row.resource_name || 'Unknown'),
            resource_type: String(row.resource_type || 'unknown'),
            total_hours_used: isNaN(totalHoursUsed) ? 0 : totalHoursUsed,
            peak_concurrent_usage: isNaN(peakConcurrent) ? 0 : peakConcurrent,
            available_quantity: isNaN(availableQty) ? 0 : availableQty,
            max_capacity: isNaN(maxCapacity) ? 0 : maxCapacity,
            utilization_percentage: isNaN(utilizationPct) ? 0 : utilizationPct,
            is_underutilized: Boolean(row.is_underutilized || false),
          };
        });
        
        return transformedResults;
      } catch (error: any) {
        // Enhanced error logging with context
        console.error('Error in getResourceUtilizationPerOrganization:', {
          error: error.message,
          stack: error.stack,
          organizationId: organizationId,
          retryCount,
          timestamp: new Date().toISOString(),
        });
        
        // Check if materialized view exists and retry ONCE if needed
        if (error.message && error.message.includes('does not exist') && retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(`Retrying after refresh (attempt ${retryCount}/${MAX_RETRIES})...`);
          try {
            await this.refreshResourceUtilizationView();
            // Retry the query once
            return executeQuery();
          } catch (refreshError: any) {
            console.error('Failed to refresh materialized view:', refreshError);
            throw new Error('Resource utilization data is not available. Please contact administrator.');
          }
        }
        
        // Re-throw with user-friendly message
        throw new Error(`Failed to retrieve resource utilization data: ${error.message}`);
      }
    };

    return executeQuery();
  }

  /**
   * d. Find parent events whose child sessions violate time boundaries
   * Uses recursive CTE to traverse parent-child relationships
   */
  async findParentEventsWithInvalidChildren(organizationId?: string): Promise<any[]> {
    let orgFilter = '';
    if (organizationId) {
      orgFilter = `AND "organizationId" = $1`;
    }

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
          ${orgFilter}
        
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
        ${organizationId ? `WHERE e."organizationId" = $1` : ''}
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

    if (organizationId) {
      return this.dataSource.query(query, [organizationId]);
    }
    return this.dataSource.query(query);
  }

  /**
   * e. List events with external attendees exceeding a threshold
   */
  async findEventsWithExternalAttendeesExceedingThreshold(threshold: number = 10, organizationId?: string): Promise<any[]> {
    let orgFilter = '';
    const params: any[] = [threshold];
    if (organizationId) {
      orgFilter = `AND e."organizationId" = $2`;
      params.push(organizationId);
    }

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
        ${orgFilter}
      GROUP BY e.id, e.title, e."startTime", e."endTime", e.capacity, o.name
      HAVING COUNT(a.id) >= $1
      ORDER BY external_attendee_count DESC, e."startTime";
    `;

    return this.dataSource.query(query, params);
  }

  /**
   * Helper: Refresh materialized view for resource utilization
   */
  async refreshResourceUtilizationView(): Promise<void> {
    try {
      // Use the function created in the migration for safer refresh
      await this.dataSource.query(`SELECT refresh_resource_utilization_summary();`);
    } catch (error) {
      console.error('Error refreshing resource utilization view:', error);
      // Fallback to direct refresh if function doesn't exist
      await this.dataSource.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY resource_utilization_summary;`);
    }
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
