import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1714400814639 implements MigrationInterface {
    name = 'Migrations1714400814639'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."wallets_status_enum" AS ENUM('ACTIVE', 'NEW', 'NOT_TRACKABLE')`);
        await queryRunner.query(`CREATE TABLE "wallets" ("created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "hash" character varying(42) NOT NULL, "alias" character varying NOT NULL, "status" "public"."wallets_status_enum" NOT NULL DEFAULT 'NEW', "last_calculated_at" TIMESTAMP, "first_transaction_date" TIMESTAMP, "last_transaction_date" TIMESTAMP, "is_use_maestro_bot" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_wallets__alias)" UNIQUE ("alias"), CONSTRAINT "PK_wallets_hash" PRIMARY KEY ("hash"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fd285ef7c3ef3b4301d99efd47" ON "wallets" ("alias") `);
        await queryRunner.query(`ALTER TABLE "fungibles" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "fungibles" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "transfers" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "transfers" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transfers" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "transfers" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "fungibles" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "fungibles" DROP COLUMN "created_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fd285ef7c3ef3b4301d99efd47"`);
        await queryRunner.query(`DROP TABLE "wallets"`);
        await queryRunner.query(`DROP TYPE "public"."wallets_status_enum"`);
    }

}
