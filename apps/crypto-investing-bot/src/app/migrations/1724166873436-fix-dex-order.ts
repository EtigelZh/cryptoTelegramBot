import { MigrationInterface, QueryRunner } from "typeorm";

export class FixDexOrder1724166873436 implements MigrationInterface {
    name = 'FixDexOrder1724166873436'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_transactions" ADD "is_mock_transaction" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TYPE "public"."dex_orders_status_enum" RENAME TO "dex_orders_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."dex_orders_status_enum" AS ENUM('BUYING', 'SELLING', 'COMPLETED')`);
        await queryRunner.query(`ALTER TABLE "dex_orders" ALTER COLUMN "status" TYPE "public"."dex_orders_status_enum" USING "status"::"text"::"public"."dex_orders_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."dex_orders_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."dex_orders_status_enum_old" AS ENUM('BUING', 'SELLING', 'COMPLETED')`);
        await queryRunner.query(`ALTER TABLE "dex_orders" ALTER COLUMN "status" TYPE "public"."dex_orders_status_enum_old" USING "status"::"text"::"public"."dex_orders_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."dex_orders_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."dex_orders_status_enum_old" RENAME TO "dex_orders_status_enum"`);
        await queryRunner.query(`ALTER TABLE "dex_transactions" DROP COLUMN "is_mock_transaction"`);
    }

}
