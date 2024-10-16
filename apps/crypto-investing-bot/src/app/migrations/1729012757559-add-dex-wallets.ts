import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDexWallets1729012757559 implements MigrationInterface {
    name = 'AddDexWallets1729012757559'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dex_walletss" ("id" SERIAL NOT NULL, "wallet_address" character varying NOT NULL, "is_auto_buy_enabled" boolean NOT NULL DEFAULT true, "is_auto_sell_enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_dex_walletss_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_38b2a6c46b5e6d5d3538069e0c" ON "dex_walletss" ("wallet_address") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "dex_walletss"`);
    }

}
