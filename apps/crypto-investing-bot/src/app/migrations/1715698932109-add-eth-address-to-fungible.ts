import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEthAddressToFungible1715698932109 implements MigrationInterface {
    name = 'AddEthAddressToFungible1715698932109'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fungibles" ADD "ethereum_address" character varying`);
        // Заполняем колонку из исходников
        await queryRunner.query(`
        UPDATE fungibles
        SET ethereum_address = updating.address
        FROM (
            SELECT f.symbol as symbol, f.implementation ->> 'address' AS address
          FROM (
            SELECT symbol, jsonb_array_elements(implementations) as implementation
            FROM fungibles
            WHERE implementations @> '[{"chain_id": "ethereum"}]'
        ) as f
        WHERE f.implementation ->> 'chain_id' = 'ethereum' AND f.implementation ->> 'address' <> ''
        ) AS updating
        WHERE fungibles.symbol = updating.symbol;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fungibles" DROP COLUMN "ethereum_address"`);
    }

}
