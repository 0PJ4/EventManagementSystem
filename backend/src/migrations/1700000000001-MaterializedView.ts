import { MigrationInterface, QueryRunner } from 'typeorm';

export class MaterializedView1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create materialized view for resource utilization summary
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW resource_utilization_summary AS
      WITH resource_hours AS (
        SELECT 
          r.id as resource_id,
          r."organizationId",
          SUM(EXTRACT(EPOCH FROM (e."endTime" - e."startTime")) / 3600) as total_hours
        FROM resources r
        INNER JOIN resource_allocations ra ON ra."resourceId" = r.id
        INNER JOIN events e ON ra."eventId" = e.id
        GROUP BY r.id, r."organizationId"
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
        r."availableQuantity",
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
      INNER JOIN resources r ON r."organizationId" = o.id
      LEFT JOIN resource_hours rh ON rh.resource_id = r.id
      LEFT JOIN resource_peak_usage rpu ON rpu.resource_id = r.id;
    `);

    // Create index on materialized view for faster queries
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_resource_utilization_summary_pk 
      ON resource_utilization_summary (organization_id, resource_id);
    `);

    // Create function to refresh the materialized view
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION refresh_resource_utilization_summary()
      RETURNS void AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY resource_utilization_summary;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS refresh_resource_utilization_summary();`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS resource_utilization_summary;`);
  }
}
