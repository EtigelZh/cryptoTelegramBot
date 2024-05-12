import { MigrationInterface, QueryRunner } from "typeorm";

export class LongTermProcessing1715506426489 implements MigrationInterface {
    name = 'LongTermProcessing1715506426489'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "long_term_processing_wallet_tasks" ("created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "id" BIGSERIAL NOT NULL, "wallet_hash" character varying NOT NULL, "priority" integer NOT NULL DEFAULT '10', "task_name" text NOT NULL DEFAULT 'calculate_wallet', "task_arguments" jsonb NOT NULL, "task_result" jsonb NOT NULL DEFAULT '{}', "started_processing_at" TIMESTAMP, "processed_at" TIMESTAMP, "is_finished" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_long_term_processing_wallet_tasks_id" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "long_term_processing_wallet_tasks"`);
    }

}
