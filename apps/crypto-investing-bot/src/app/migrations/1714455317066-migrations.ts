import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1714455317066 implements MigrationInterface {
    name = 'Migrations1714455317066'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."transfers_direction_enum" RENAME TO "transfers_direction_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transfers_direction_enum" AS ENUM('in', 'out', 'self')`);
        await queryRunner.query(`ALTER TABLE "transfers" ALTER COLUMN "direction" TYPE "public"."transfers_direction_enum" USING "direction"::"text"::"public"."transfers_direction_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transfers_direction_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."transfers_direction_enum_old" AS ENUM('in', 'out')`);
        await queryRunner.query(`ALTER TABLE "transfers" ALTER COLUMN "direction" TYPE "public"."transfers_direction_enum_old" USING "direction"::"text"::"public"."transfers_direction_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transfers_direction_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transfers_direction_enum_old" RENAME TO "transfers_direction_enum"`);
    }

}
