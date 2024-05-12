import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { FinanceData } from '../google-api/google-sheets/google-sheets.models';
import { WithUpdatedAndCreatedAt } from '../utils/base.entity';

@Entity()
export class FinanceDataEntity extends WithUpdatedAndCreatedAt implements FinanceData  {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sourceDocumentId: string;

  @Column()
  sourceLink: string;

  @Column()
  walletHash: string;

  @Column({ nullable: true })
  walletAlias: string;

  @Column()
  medianEntry: string;

  @Column()
  avgLose: string;

  @Column()
  avgWin: string;

  @Column()
  medianPurchaseCount: string;

  @Column()
  RR: string;

  @Column()
  averageEntry: string;

  @Column()
  medianLose: string;

  @Column()
  medianWin: string;

  @Column()
  tradedCoins: string;

  @Column()
  balance: string;

  @Column()
  copyTradingThreshold: string;

  @Column()
  winRateRCT: string;

  @Column()
  PLRCT: string;

  @Column()
  lastTransactionDate: string;

  @Column()
  tripleTransaction: string;

  @Column()
  lastXDays: string;

  @Column()
  winRateR: string;

  @Column()
  PLR: string;

  @Column()
  averageTermDays: string;

  @Column()
  annualYieldR: string;

  @Column()
  commissions: string;

  @Column()
  winRateTotal: string;

  @Column()
  PLTotal: string;

  @Column()
  riskProfile: string;

  @Column()
  annualYield: string;

  @Column()
  averageCommission: string;
}
