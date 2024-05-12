import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateFinancialData1715530227847 implements MigrationInterface {
    name = 'UpdateFinancialData1715530227847'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "finance_datas" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "finance_datas" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "finance_datas" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "finance_datas" DROP COLUMN "created_at"`);
    }

}
