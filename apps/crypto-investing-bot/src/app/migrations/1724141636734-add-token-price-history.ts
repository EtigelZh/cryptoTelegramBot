import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTokenPriceHistory1724141636734 implements MigrationInterface {
    name = 'AddTokenPriceHistory1724141636734'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "token_price_histories" ("id" SERIAL NOT NULL, "token_address" character varying NOT NULL, "price_in_eth_per_token" numeric NOT NULL, "price_in_tokens_per_eth" numeric NOT NULL, "recorded_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_token_price_histories_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_transaction_type_enum" RENAME TO "transactions_transaction_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_type_enum" AS ENUM('approve', 'borrow', 'burn', 'cancel', 'claim', 'deploy', 'deposit', 'execute', 'mint', 'receive', 'repay', 'send', 'stake', 'trade', 'unstake', 'withdraw')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "transaction_type" TYPE "public"."transactions_transaction_type_enum" USING "transaction_type"::"text"::"public"."transactions_transaction_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_type_enum_old" AS ENUM('send', 'receive', 'execute', 'trade', 'approve', 'withdraw', 'deposit', 'mint', 'unknown', 'burn', 'stake', 'unstake', 'borrow', 'repay', 'cancel', 'claim', 'deploy')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "transaction_type" TYPE "public"."transactions_transaction_type_enum_old" USING "transaction_type"::"text"::"public"."transactions_transaction_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_transaction_type_enum_old" RENAME TO "transactions_transaction_type_enum"`);
        await queryRunner.query(`DROP TABLE "token_price_histories"`);
    }

}
