import { MigrationInterface, QueryRunner } from "typeorm";

export class FixDexOrdersStatusEnumTypo1727083802740 implements MigrationInterface {
    name = 'FixDexOrdersStatusEnumTypo1727083802740'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Проверяем, существует ли значение 'BUING' в перечислении
        const checkExists = await queryRunner.query(`
            SELECT 1 
            FROM pg_type t 
            JOIN pg_enum e ON t.oid = e.enumtypid 
            WHERE t.typname = 'dex_orders_status_enum' 
              AND e.enumlabel = 'BUING';
        `);

        if (checkExists.length > 0) {
            // Обновляем существующие записи со статусом 'BUING' на 'BUYING'
            await queryRunner.query(`
                UPDATE "dex_orders"
                SET "status" = 'BUYING'
                WHERE "status" = 'BUING';
            `);

            // Переименовываем 'BUING' в 'BUYING'
            await queryRunner.query(`
                ALTER TYPE "public"."dex_orders_status_enum" RENAME VALUE 'BUING' TO 'BUYING';
            `);
        } else {
            // Логируем, что значение 'BUING' не найдено и переименование не требуется
            console.log("Value 'BUING' does not exist in 'dex_orders_status_enum'. No action taken.");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Проверяем, существует ли значение 'BUYING' в перечислении
        const checkExists = await queryRunner.query(`
            SELECT 1 
            FROM pg_type t 
            JOIN pg_enum e ON t.oid = e.enumtypid 
            WHERE t.typname = 'dex_orders_status_enum' 
              AND e.enumlabel = 'BUYING';
        `);

        if (checkExists.length > 0) {
            // Обновляем существующие записи со статусом 'BUYING' обратно на 'BUING'
            await queryRunner.query(`
                UPDATE "dex_orders"
                SET "status" = 'BUING'
                WHERE "status" = 'BUYING';
            `);

            // Переименовываем 'BUYING' обратно в 'BUING'
            await queryRunner.query(`
                ALTER TYPE "public"."dex_orders_status_enum" RENAME VALUE 'BUYING' TO 'BUING';
            `);
        } else {
            // Логируем, что значение 'BUYING' не найдено и переименование не требуется
            console.log("Value 'BUYING' does not exist in 'dex_orders_status_enum'. No action taken.");
        }
    }
}