import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
  
  @Entity()
  export class DexWalletsEntity {
    @PrimaryGeneratedColumn()
    id: number;
  
    /** Адрес отслеживаемого кошелька */
    @Column()
    @Index()
    walletAddress: string;
  
    /** Флаг, указывающий, включено ли автоматическое следование за покупками */
    @Column({ default: true })
    isAutoBuyEnabled: boolean;
  
    /** Флаг, указывающий, включено ли автоматическое следование за продажами */
    @Column({ default: true })
    isAutoSellEnabled: boolean;
  }