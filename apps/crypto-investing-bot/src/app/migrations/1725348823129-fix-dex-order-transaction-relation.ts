import { MigrationInterface, QueryRunner } from "typeorm";

export class FixDexOrderTransactionRelation1725348823129 implements MigrationInterface {
    name = 'FixDexOrderTransactionRelation1725348823129'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" ADD "buying_transactions" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "dex_orders" ADD "selling_transactions" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" DROP COLUMN "selling_transactions"`);
        await queryRunner.query(`ALTER TABLE "dex_orders" DROP COLUMN "buying_transactions"`);
    }

}
