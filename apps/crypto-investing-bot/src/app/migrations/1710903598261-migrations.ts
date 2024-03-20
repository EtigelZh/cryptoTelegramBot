import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1710903598261 implements MigrationInterface {
    name = 'Migrations1710903598261'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "finance_datas" DROP COLUMN "last_transaction_date"`);
        await queryRunner.query(`ALTER TABLE "finance_datas" ADD "last_transaction_date" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "finance_datas" DROP COLUMN "last_transaction_date"`);
        await queryRunner.query(`ALTER TABLE "finance_datas" ADD "last_transaction_date" date NOT NULL`);
    }

}
