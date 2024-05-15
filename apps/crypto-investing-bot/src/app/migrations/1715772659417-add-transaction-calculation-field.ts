import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionCalculationField1715772659417 implements MigrationInterface {
    name = 'AddTransactionCalculationField1715772659417'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" ADD "in_out_transaction_fields_version" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "in_out_transaction_fields_version"`);
    }

}
