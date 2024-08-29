import { MigrationInterface, QueryRunner } from "typeorm";

export class FixDexOrder1724933944698 implements MigrationInterface {
    name = 'FixDexOrder1724933944698'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" ALTER COLUMN "completed_reason" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dex_orders" ALTER COLUMN "completed_reason" SET NOT NULL`);
    }

}
