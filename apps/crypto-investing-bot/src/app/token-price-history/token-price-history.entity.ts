import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class TokenPriceHistoryEntity {
    @PrimaryGeneratedColumn()
    id: number;

    /** Адрес контракта токена */
    @Column()
    tokenAddress: string;

    /** Цена в эфирах за 1 токен */
    @Column({ type: 'numeric' })
    priceInEthPerToken: number;

    /** Цена токенов на 1 эфир */
    @Column({ type: 'numeric' })
    priceInTokensPerEth: number;

    /** Дата записи цены */
    @CreateDateColumn()
    recordedAt: Date;
}