import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWalletStatus1715659193275 implements MigrationInterface {
    name = 'AddWalletStatus1715659193275'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallets" ADD "search_last_block_no" bigint`);
        await queryRunner.query(`ALTER TYPE "public"."wallets_status_enum" ADD VALUE IF NOT EXISTS 'LOW_TRADES'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "search_last_block_no"`);
    }

}
