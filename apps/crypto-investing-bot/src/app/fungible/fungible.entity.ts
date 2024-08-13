import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import type { Implementation } from "../zerion-api/zerion-api.models";
import { CurrencySymbol } from "../utils/models";
import { WithUpdatedAndCreatedAt } from "../utils/base.entity";

@Entity()
export class FungibleEntity extends WithUpdatedAndCreatedAt {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: 'text', unique: false })
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

    /** Адрес валюты в сети эфир */
    @Column({ nullable: false, unique: true })
    ethereumAddress?: string;
}
