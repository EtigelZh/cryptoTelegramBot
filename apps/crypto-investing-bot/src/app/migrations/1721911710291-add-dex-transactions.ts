import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDexTransactions1721911710291 implements MigrationInterface {
    name = 'AddDexTransactions1721911710291'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."dex_transactions_action_enum" AS ENUM('BUY', 'SELL')`);
        await queryRunner.query(`CREATE TABLE "dex_transactions" ("id" SERIAL NOT NULL, "computed_hash" character varying NOT NULL, "transaction_hash" character varying NOT NULL, "block_number" integer NOT NULL, "token_address" character varying NOT NULL, "action" "public"."dex_transactions_action_enum" NOT NULL, "economics" jsonb NOT NULL, "message" jsonb NOT NULL, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "wallet_hash" character varying(42), CONSTRAINT "UQ_dex_transactions__computed_hash)" UNIQUE ("computed_hash"), CONSTRAINT "PK_dex_transactions_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_093f632acf5915beaf33c5d2b3" ON "dex_transactions" ("transaction_hash") `);
        await queryRunner.query(`CREATE INDEX "IDX_89ae8db04598d56ecbfd6d723a" ON "dex_transactions" ("block_number") `);
        await queryRunner.query(`CREATE INDEX "IDX_3a6524ca0657ff69f248b28496" ON "dex_transactions" ("token_address") `);
        await queryRunner.query(`ALTER TABLE "dex_transactions" ADD CONSTRAINT "FK_dex_transactions__wallet_hash___wallets__hash" FOREIGN KEY ("wallet_hash") REFERENCES "wallets"("hash") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_transactions" DROP CONSTRAINT "FK_dex_transactions__wallet_hash___wallets__hash"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3a6524ca0657ff69f248b28496"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_89ae8db04598d56ecbfd6d723a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_093f632acf5915beaf33c5d2b3"`);
        await queryRunner.query(`DROP TABLE "dex_transactions"`);
        await queryRunner.query(`DROP TYPE "public"."dex_transactions_action_enum"`);
    }

}
