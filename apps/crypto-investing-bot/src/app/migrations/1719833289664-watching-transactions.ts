import { MigrationInterface, QueryRunner } from "typeorm";

export class WatchingTransactions1719833289664 implements MigrationInterface {
    name = 'WatchingTransactions1719833289664'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallets" ADD "is_watching" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "is_watching"`);
    }

}
