import { MigrationInterface, QueryRunner } from "typeorm";

export class FixDexOrder1724166873436 implements MigrationInterface {
    name = 'FixDexOrder1724166873436'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_transactions" ADD "is_mock_transaction" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_transactions" DROP COLUMN "is_mock_transaction"`);
    }

}
