import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDexOrders1723560223623 implements MigrationInterface {
    name = 'AddDexOrders1723560223623'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."dex_orders_status_enum" AS ENUM('BUING', 'SELLING', 'COMPLETED')`);
        await queryRunner.query(`CREATE TYPE "public"."dex_orders_completed_reason_enum" AS ENUM('TRADING_PROFIT', 'MISSED_BUYING_PRICE', 'MISSING_SELLING_PRICE', 'MANUAL')`);
        await queryRunner.query(`CREATE TABLE "dex_orders" ("id" SERIAL NOT NULL, "status" "public"."dex_orders_status_enum" NOT NULL, "completed_reason" "public"."dex_orders_completed_reason_enum" NOT NULL, "token_address" character varying NOT NULL, "source_buying_transaction_hash" character varying NOT NULL, "source_buying_transaction_block_number" integer NOT NULL, "source_buying_transaction_date" TIMESTAMP NOT NULL, "source_buying_transaction_price" numeric NOT NULL, "source_buying_transaction_amount" numeric NOT NULL, "target_buying_price" numeric NOT NULL, "target_buying_amount_eth" numeric NOT NULL, "target_selling_price" numeric NOT NULL, "target_selling_amount_token_percent" numeric NOT NULL, "additional_fields" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "copy_trading_wallet_hash" character varying(42), "wallet_hash" character varying(42), CONSTRAINT "PK_dex_orders_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f500a07d3d24ed1b0a70da5aeb" ON "dex_orders" ("token_address") `);
        await queryRunner.query(`ALTER TABLE "dex_orders" ADD CONSTRAINT "FK_dex_orders__copy_trading_wallet_hash___wallets__hash" FOREIGN KEY ("copy_trading_wallet_hash") REFERENCES "wallets"("hash") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dex_orders" ADD CONSTRAINT "FK_dex_orders__wallet_hash___wallets__hash" FOREIGN KEY ("wallet_hash") REFERENCES "wallets"("hash") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`DROP TABLE "transfers";`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" DROP CONSTRAINT "FK_dex_orders__wallet_hash___wallets__hash"`);
        await queryRunner.query(`ALTER TABLE "dex_orders" DROP CONSTRAINT "FK_dex_orders__copy_trading_wallet_hash___wallets__hash"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f500a07d3d24ed1b0a70da5aeb"`);
        await queryRunner.query(`DROP TABLE "dex_orders"`);
        await queryRunner.query(`DROP TYPE "public"."dex_orders_completed_reason_enum"`);
        await queryRunner.query(`DROP TYPE "public"."dex_orders_status_enum"`);
    }

}
