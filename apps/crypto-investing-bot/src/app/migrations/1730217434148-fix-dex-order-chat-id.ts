import { MigrationInterface, QueryRunner } from "typeorm";

export class FixDexOrderChatId1730217434148 implements MigrationInterface {
    name = 'FixDexOrderChatId1730217434148'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" DROP COLUMN "chat_dex_order_id"`);
        await queryRunner.query(`ALTER TABLE "dex_orders" ADD "chat_dex_order_id" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" DROP COLUMN "chat_dex_order_id"`);
        await queryRunner.query(`ALTER TABLE "dex_orders" ADD "chat_dex_order_id" integer`);
    }

}
