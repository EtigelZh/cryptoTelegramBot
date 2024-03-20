import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1710903496475 implements MigrationInterface {
    name = 'Migrations1710903496475'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "finance_datas" ADD "id" SERIAL NOT NULL`);
        await queryRunner.query(`ALTER TABLE "finance_datas" DROP CONSTRAINT "PK_finance_datas_source_document_id"`);
        await queryRunner.query(`ALTER TABLE "finance_datas" ADD CONSTRAINT "PK_finance_datas_id_source_document_id" PRIMARY KEY ("source_document_id", "id")`);
        await queryRunner.query(`ALTER TABLE "finance_datas" DROP CONSTRAINT "PK_finance_datas_id_source_document_id"`);
        await queryRunner.query(`ALTER TABLE "finance_datas" ADD CONSTRAINT "PK_finance_datas_id" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "finance_datas" DROP COLUMN "source_document_id"`);
        await queryRunner.query(`ALTER TABLE "finance_datas" ADD "source_document_id" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "finance_datas" DROP COLUMN "source_document_id"`);
        await queryRunner.query(`ALTER TABLE "finance_datas" ADD "source_document_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "finance_datas" DROP CONSTRAINT "PK_finance_datas_id"`);
        await queryRunner.query(`ALTER TABLE "finance_datas" ADD CONSTRAINT "PK_finance_datas_id_source_document_id" PRIMARY KEY ("source_document_id", "id")`);
        await queryRunner.query(`ALTER TABLE "finance_datas" DROP CONSTRAINT "PK_finance_datas_id_source_document_id"`);
        await queryRunner.query(`ALTER TABLE "finance_datas" ADD CONSTRAINT "PK_finance_datas_source_document_id" PRIMARY KEY ("source_document_id")`);
        await queryRunner.query(`ALTER TABLE "finance_datas" DROP COLUMN "id"`);
    }

}
