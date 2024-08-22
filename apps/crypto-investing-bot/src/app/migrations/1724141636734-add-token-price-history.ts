import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTokenPriceHistory1724141636734 implements MigrationInterface {
    name = 'AddTokenPriceHistory1724141636734'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "token_price_histories" ("id" SERIAL NOT NULL, "token_address" character varying NOT NULL, "price_in_eth_per_token" numeric NOT NULL, "price_in_tokens_per_eth" numeric NOT NULL, "recorded_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_token_price_histories_id" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "token_price_histories"`);
    }

}
