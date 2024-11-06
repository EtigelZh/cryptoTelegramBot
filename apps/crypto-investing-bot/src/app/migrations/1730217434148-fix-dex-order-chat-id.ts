import { MigrationInterface, QueryRunner } from "typeorm";

export class FixDexOrderChatId1730217434148 implements MigrationInterface {
    name = 'FixDexOrderChatId1730217434148'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Create a temporary column to store the current data as text
        await queryRunner.query(`ALTER TABLE "dex_orders" ADD "chat_dex_order_id_temp" character varying`);

        // Step 2: Copy all data from the original column to the temporary column as strings
        await queryRunner.query(`UPDATE "dex_orders" SET "chat_dex_order_id_temp" = "chat_dex_order_id"::text`);

        // Step 3: Drop the original column
        await queryRunner.query(`ALTER TABLE "dex_orders" DROP COLUMN "chat_dex_order_id"`);

        // Step 4: Rename the temporary column to the original column name
        await queryRunner.query(`ALTER TABLE "dex_orders" RENAME COLUMN "chat_dex_order_id_temp" TO "chat_dex_order_id"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" DROP COLUMN "chat_dex_order_id"`);
        await queryRunner.query(`ALTER TABLE "dex_orders" ADD "chat_dex_order_id" integer`);
    }

}
