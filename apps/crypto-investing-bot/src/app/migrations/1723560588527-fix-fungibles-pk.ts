import { MigrationInterface, QueryRunner } from "typeorm";

export class FixFungiblesPk1723560588527 implements MigrationInterface {
    name = 'FixFungiblesPk1723560588527'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fungibles" ADD "id" SERIAL NOT NULL`);
        await queryRunner.query(`ALTER TABLE "fungibles" DROP CONSTRAINT "PK_fungibles_symbol"`);
        await queryRunner.query(`ALTER TABLE "fungibles" ADD CONSTRAINT "PK_fungibles_id_symbol" PRIMARY KEY ("symbol", "id")`);
        await queryRunner.query(`ALTER TABLE "fungibles" DROP CONSTRAINT "PK_fungibles_id_symbol"`);
        await queryRunner.query(`ALTER TABLE "fungibles" ADD CONSTRAINT "PK_fungibles_id" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "fungibles" ALTER COLUMN "ethereum_address" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "fungibles" ADD CONSTRAINT "UQ_fungibles__ethereum_address)" UNIQUE ("ethereum_address")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fungibles" DROP CONSTRAINT "UQ_fungibles__ethereum_address)"`);
        await queryRunner.query(`ALTER TABLE "fungibles" ALTER COLUMN "ethereum_address" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "fungibles" DROP CONSTRAINT "PK_fungibles_id"`);
        await queryRunner.query(`ALTER TABLE "fungibles" ADD CONSTRAINT "PK_fungibles_id_symbol" PRIMARY KEY ("symbol", "id")`);
        await queryRunner.query(`ALTER TABLE "fungibles" DROP CONSTRAINT "PK_fungibles_id_symbol"`);
        await queryRunner.query(`ALTER TABLE "fungibles" ADD CONSTRAINT "PK_fungibles_symbol" PRIMARY KEY ("symbol")`);
        await queryRunner.query(`ALTER TABLE "fungibles" DROP COLUMN "id"`);
    }

}
