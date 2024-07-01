import { MigrationInterface, QueryRunner } from "typeorm";

export class WatchingStats1719834487494 implements MigrationInterface {
    name = 'WatchingStats1719834487494'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallets" ADD "wallet_subscription_messages" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "wallet_subscription_messages"`);
    }

}
