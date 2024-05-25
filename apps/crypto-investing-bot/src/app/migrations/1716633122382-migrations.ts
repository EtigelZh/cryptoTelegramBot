import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1716633122382 implements MigrationInterface {
    name = 'Migrations1716633122382'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" ADD "receive_currency_address" character varying(42)`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "spent_currency_address" character varying(42)`);
        await queryRunner.query(`ALTER TABLE "transfers" ADD "amount_currency_address" character varying(42)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_type_enum_old" AS ENUM('send', 'receive', 'execute', 'trade', 'approve', 'withdraw', 'deposit', 'mint', 'unknown', 'burn', 'stake', 'unstake', 'borrow', 'repay', 'cancel', 'claim', 'deploy')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "transaction_type" TYPE "public"."transactions_transaction_type_enum_old" USING "transaction_type"::"text"::"public"."transactions_transaction_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_transaction_type_enum_old" RENAME TO "transactions_transaction_type_enum"`);
        await queryRunner.query(`ALTER TABLE "transfers" DROP COLUMN "amount_currency_address"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "spent_currency_address"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "receive_currency_address"`);
    }

}
