import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEconomicsToWallet1715765975897 implements MigrationInterface {
    name = 'AddEconomicsToWallet1715765975897'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallets" ADD "wallet_financial_stats" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "wallet_financial_stats"`);
    }

}
