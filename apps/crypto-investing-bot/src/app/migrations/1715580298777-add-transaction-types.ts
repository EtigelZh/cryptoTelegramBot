import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransactionTypes1715580298777 implements MigrationInterface {
  name = 'AddTransactionTypes1715580298777';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Assuming 'stake', 'unstake', 'borrow', 'repay', 'cancel', 'claim', and 'deploy' are new types to be added
    const newTypes = ['stake', 'unstake', 'borrow', 'repay', 'cancel', 'claim', 'deploy'];
    for (const type of newTypes) {
      await queryRunner.query(`ALTER TYPE "public"."transactions_transaction_type_enum" ADD VALUE IF NOT EXISTS '${type}'`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from an enum directly.
    // If you need to revert the enum to its previous state, you would typically have to create a new enum without the new values, update the column, and then drop the old enum.
    // However, for simplicity and to prevent accidental data loss, this down migration will not attempt to remove types added in the up migration.
    console.warn('Down migration for PostgreSQL enum types does not support removing values. Manual intervention or migration strategy adjustments may be required.');
  }
}
