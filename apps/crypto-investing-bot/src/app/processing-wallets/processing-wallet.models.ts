import { ZerionApiQueueName } from '../zerion-api/zerion-api.models';

export type TaskResult<T = unknown> = {
  result: T;
  errorMessage?: string;
}

export type ProcessingWalletArguments = {
  walletHash: string;
  chatId: number;
  suffix: string;
  parentMessageId: number | null;
  apiKeyQueueName: ZerionApiQueueName;
  calculateScore: boolean;
  /** Если true - сообщения в telegram не отправляются */
  silent?: boolean;
  longTermTaskId?: number;
};
