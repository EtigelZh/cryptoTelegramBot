import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { WithUpdatedAndCreatedAt } from '../utils/base.entity';
import { ProcessingWalletArguments, TaskResult } from './processing-wallet.models';

@Entity()
export class LongTermProcessingWalletTaskEntity extends WithUpdatedAndCreatedAt {
  @PrimaryGeneratedColumn({ type: 'bigint'})
  id: number;

  @Column()
  walletHash: string;

  @Column({ default: 10 })
  priority: number;

  @Column({ type: 'text', default: 'calculate_wallet' })
  taskName: string | 'calculate_wallet';

  @Column({ type: 'jsonb' })
  taskArguments: ProcessingWalletArguments;

  @Column({ type: 'jsonb', default: {}})
  taskResult: TaskResult;

  @Column({ nullable: true })
  startedProcessingAt: Date;

  @Column({ nullable: true })
  processedAt: Date;

  @Column({ default: false })
  isFinished: boolean;
}
