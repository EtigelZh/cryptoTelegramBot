import { Column, Entity, PrimaryColumn } from "typeorm";
import type { Implementation } from "../zerion-api/zerion-api.models";
import { CurrencySymbol } from "../utils/models";

@Entity()
export class FungibleEntity {
    @PrimaryColumn({type: 'text'})
    symbol: CurrencySymbol;

    @Column()
    name: string;

    /** placed in fungible_info.flags.verified */
    @Column()
    zerionVerified: boolean;

    @Column({type: 'jsonb'})
    implementations: Implementation[];

    @Column({ type: 'numeric', nullable: true })
    marketCapUsd: number;
}