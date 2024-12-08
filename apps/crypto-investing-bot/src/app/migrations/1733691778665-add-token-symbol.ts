import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTokenSymbol1733691778665 implements MigrationInterface {
    name = 'AddTokenSymbol1733691778665'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_transactions" ADD "token_symbol" character varying`);
        await queryRunner.query(`ALTER TABLE "dex_orders" ADD "token_symbol" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" DROP COLUMN "token_symbol"`);
        await queryRunner.query(`ALTER TABLE "dex_transactions" DROP COLUMN "token_symbol"`);
    }

}
