import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBurnTransaction1715507835070 implements MigrationInterface {
  name = 'AddBurnTransaction1715507835070'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."transactions_transaction_type_enum" ADD VALUE 'burn'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_type_enum_temp" AS ENUM('send', 'receive', 'execute', 'trade', 'approve', 'withdraw', 'deposit', 'mint', 'unknown')`);
    await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "transaction_type" TYPE "public"."transactions_transaction_type_enum_temp" USING "transaction_type"::"text"::"public"."transactions_transaction_type_enum_temp"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_transaction_type_enum"`);
    await queryRunner.query(`ALTER TYPE "public"."transactions_transaction_type_enum_temp" RENAME TO "transactions_transaction_type_enum"`);
  }
}
