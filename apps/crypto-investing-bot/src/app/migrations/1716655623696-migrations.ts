import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1716655623696 implements MigrationInterface {
    name = 'Migrations1716655623696'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "eth_transfers" ("created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "id" BIGSERIAL NOT NULL, "block_number" character varying NOT NULL, "time_stamp" character varying NOT NULL, "hash" character varying(66) NOT NULL, "nonce" character varying NOT NULL, "block_hash" character varying NOT NULL, "from" character varying(42) NOT NULL, "contract_address" character varying(42) NOT NULL, "to" character varying(42) NOT NULL, "value" character varying NOT NULL, "token_name" character varying NOT NULL, "token_symbol" character varying NOT NULL, "token_decimal" character varying NOT NULL, "transaction_index" character varying NOT NULL, "gas" character varying NOT NULL, "gas_price" character varying NOT NULL, "gas_used" character varying NOT NULL, "cumulative_gas_used" character varying NOT NULL, "confirmations" character varying NOT NULL, CONSTRAINT "PK_eth_transfers_id" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "eth_transfers"`);
    }

}
