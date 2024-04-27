import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1714222936493 implements MigrationInterface {
    name = 'Migrations1714222936493'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "fungibles" ("symbol" text NOT NULL, "name" character varying NOT NULL, "zerion_verified" boolean NOT NULL, "implementations" jsonb NOT NULL, "market_cap_usd" numeric, CONSTRAINT "PK_fungibles_symbol" PRIMARY KEY ("symbol"))`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_status_enum" AS ENUM('confirmed', 'failed', 'pending')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_type_enum" AS ENUM('send', 'receive', 'execute', 'trade', 'approve', 'unknown')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" character varying(66) NOT NULL, "from" character varying(42) NOT NULL, "to" character varying(42) NOT NULL, "date" TIMESTAMP NOT NULL, "block_number" integer NOT NULL, "nonce" integer NOT NULL, "status" "public"."transactions_status_enum" NOT NULL, "transaction_type" "public"."transactions_transaction_type_enum", "fee" numeric NOT NULL, "fee_currency" character varying(32) NOT NULL, "fee_usd" numeric, "fee_usd_rate" numeric, "chain" character varying, "app" character varying, "receive_amount" numeric, "receive_currency" character varying(32), "receive_usd" numeric, "receive_usd_rate" numeric, "spent_amount" numeric, "spent_currency" character varying(32), "spent_usd" numeric, "spent_usd_rate" numeric, "zerion_id" character varying, "zerion_source" jsonb, "etherscan_source" jsonb, CONSTRAINT "PK_transactions_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_79051061f6a7553a524383671d" ON "transactions" ("from") `);
        await queryRunner.query(`CREATE INDEX "IDX_2fdb5277f14e26e749075fcdd7" ON "transactions" ("to") `);
        await queryRunner.query(`CREATE INDEX "IDX_d66471a99dd3836e1528d39a1e" ON "transactions" ("date") `);
        await queryRunner.query(`CREATE TYPE "public"."transfers_direction_enum" AS ENUM('in', 'out')`);
        await queryRunner.query(`CREATE TABLE "transfers" ("transaction_id" character varying(66) NOT NULL, "from" character varying(42) NOT NULL, "to" character varying(42) NOT NULL, "direction" "public"."transfers_direction_enum" NOT NULL, "transaction_date" TIMESTAMP NOT NULL, "block_no" integer NOT NULL, "method" character varying, "amount" numeric NOT NULL, "amount_currency" character varying(32) NOT NULL, "amount_usd" numeric, "amount_usd_rate" numeric, "quantity" jsonb NOT NULL, CONSTRAINT "PK_transfers_from_to_transaction_id" PRIMARY KEY ("transaction_id", "from", "to"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "transfers"`);
        await queryRunner.query(`DROP TYPE "public"."transfers_direction_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d66471a99dd3836e1528d39a1e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2fdb5277f14e26e749075fcdd7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_79051061f6a7553a524383671d"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
        await queryRunner.query(`DROP TABLE "fungibles"`);
    }

}
