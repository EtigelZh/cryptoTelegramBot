import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1710903030686 implements MigrationInterface {
    name = 'Migrations1710903030686'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "finance_datas" ("source_document_id" uuid NOT NULL, "source_link" character varying NOT NULL, "wallet_hash" character varying NOT NULL, "wallet_alias" character varying, "median_entry" character varying NOT NULL, "avg_lose" character varying NOT NULL, "avg_win" character varying NOT NULL, "median_purchase_count" character varying NOT NULL, "rr" character varying NOT NULL, "average_entry" character varying NOT NULL, "median_lose" character varying NOT NULL, "median_win" character varying NOT NULL, "traded_coins" character varying NOT NULL, "balance" character varying NOT NULL, "copy_trading_threshold" character varying NOT NULL, "win_rate_rct" character varying NOT NULL, "plrct" character varying NOT NULL, "last_transaction_date" date NOT NULL, "triple_transaction" character varying NOT NULL, "last_x_days" character varying NOT NULL, "win_rate_r" character varying NOT NULL, "plr" character varying NOT NULL, "average_term_days" character varying NOT NULL, "annual_yield_r" character varying NOT NULL, "commissions" character varying NOT NULL, "win_rate_total" character varying NOT NULL, "pl_total" character varying NOT NULL, "risk_profile" character varying NOT NULL, "annual_yield" character varying NOT NULL, "average_commission" character varying NOT NULL, CONSTRAINT "PK_finance_datas_source_document_id" PRIMARY KEY ("source_document_id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "finance_datas"`);
    }

}
