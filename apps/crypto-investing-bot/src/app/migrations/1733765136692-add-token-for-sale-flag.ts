import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTokenForSaleFlag1733765136692 implements MigrationInterface {
    name = 'AddTokenForSaleFlag1733765136692'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" ADD "is_token_for_sale" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" DROP COLUMN "is_token_for_sale"`);
    }

}
