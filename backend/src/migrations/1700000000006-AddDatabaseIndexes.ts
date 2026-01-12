import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddDatabaseIndexes1700000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add index on Event.parentEventId
    await queryRunner.createIndex(
      'events',
      new TableIndex({
        name: 'IDX_events_parentEventId',
        columnNames: ['parentEventId'],
      }),
    );

    // Add index on Invite.invitedByOrganizationId
    await queryRunner.createIndex(
      'invites',
      new TableIndex({
        name: 'IDX_invites_invitedByOrganizationId',
        columnNames: ['invitedByOrganizationId'],
      }),
    );

    // Add index on Invite.invitedByUserId
    await queryRunner.createIndex(
      'invites',
      new TableIndex({
        name: 'IDX_invites_invitedByUserId',
        columnNames: ['invitedByUserId'],
      }),
    );

    // Add index on Resource.organizationId
    await queryRunner.createIndex(
      'resources',
      new TableIndex({
        name: 'IDX_resources_organizationId',
        columnNames: ['organizationId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('events', 'IDX_events_parentEventId');
    await queryRunner.dropIndex('invites', 'IDX_invites_invitedByOrganizationId');
    await queryRunner.dropIndex('invites', 'IDX_invites_invitedByUserId');
    await queryRunner.dropIndex('resources', 'IDX_resources_organizationId');
  }
}
