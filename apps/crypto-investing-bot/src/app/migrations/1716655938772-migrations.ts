import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1716655938772 implements MigrationInterface {
    name = 'Migrations1716655938772'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "eth_internal_transactions" ("created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "id" BIGSERIAL NOT NULL, "block_number" character varying NOT NULL, "time_stamp" character varying NOT NULL, "hash" character varying NOT NULL, "from" character varying(42) NOT NULL, "to" character varying(42) NOT NULL, "value" numeric(36,0) NOT NULL, "contract_address" character varying, "input" character varying, "type" character varying NOT NULL, "gas" numeric(36,0) NOT NULL, "gas_used" numeric(36,0) NOT NULL, "trace_id" character varying NOT NULL, "is_error" character varying NOT NULL, "err_code" character varying, CONSTRAINT "PK_eth_internal_transactions_id" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "eth_internal_transactions"`);
    }

}
