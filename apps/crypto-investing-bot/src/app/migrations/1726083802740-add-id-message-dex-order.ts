import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIdMessageDexOrder1726083802740 implements MigrationInterface {
    name = 'AddIdMessageDexOrder1726083802740'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" ADD "message_dex_order_id" integer`);
        await queryRunner.query(`ALTER TABLE "dex_orders" ADD "chat_dex_order_id" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" DROP COLUMN "chat_dex_order_id"`);
        await queryRunner.query(`ALTER TABLE "dex_orders" DROP COLUMN "message_dex_order_id"`);
    }

}
