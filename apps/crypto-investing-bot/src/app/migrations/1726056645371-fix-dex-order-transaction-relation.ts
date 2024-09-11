import { MigrationInterface, QueryRunner } from "typeorm";

export class FixDexOrderTransactionRelation1726056645371 implements MigrationInterface {
    name = 'FixDexOrderTransactionRelation1726056645371'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" ADD "message_transaction" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" DROP COLUMN "message_transaction"`);
    }

}
