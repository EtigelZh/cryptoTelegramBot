import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDexOrderIsAutoSellEnabled1729610353605 implements MigrationInterface {
    name = 'AddDexOrderIsAutoSellEnabled1729610353605'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" ADD "is_auto_sell_enabled" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" DROP COLUMN "is_auto_sell_enabled"`);
    }

}
