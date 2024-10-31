import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppConfig } from '../app.config';
import { AnalyticsService } from '../analytics/analytics.service';
import { ZerionApiService } from '../zerion-api/zerion-api.service';
import { TelegramJobApiService } from '../telegraf/telegram-job-api.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { isNumber } from '@nestjs/common/utils/shared.utils';
import { ErrorHandlingService } from '../error-handling/error-handling-service';
import { ProcessingWalletsJobApiService } from '../processing-wallets/processing-wallets-job-api.service';
import { GoogleDriveService } from '../google-api/google-drive.service';

function getDailyRedisKey(date = new Date()): string {
  return `daily-report-${date.toISOString().split('T')[0]}`;
}

/**
 * Преобразует байты в гигабайты.
 * @param bytes - Количество байтов.
 * @returns Количество гигабайтов.
 */
function bytesToGigabytes(bytes: number): number {
  const bytesInGigabyte = 1024 * 1024 * 1024;
  return bytes / bytesInGigabyte;
}

@Injectable()
export class TelegramReportingService {
  private _lastMessageId: number;

  constructor(
    private _appConfig: AppConfig,
    private _analyticsService: AnalyticsService,
    private _zerionApiService: ZerionApiService,
    private _telegramJobApiService: TelegramJobApiService,
    private _errorHandlingService: ErrorHandlingService,
    private _googleDriveService: GoogleDriveService,
    private _processingWalletsJobApiService: ProcessingWalletsJobApiService,
    @Inject(CACHE_MANAGER) private readonly _cacheManager: Cache
  ) {
    this._cacheManager.get(getDailyRedisKey()).then((value) => {
      const messageId = +value;
      if (isNumber(messageId)) {
        this._lastMessageId = messageId;
      }
    });
  }


  @Cron(AppConfig.newMessageTelegramReportingCron)
  async resetReportingMessage() {
    this._lastMessageId = await this._telegramJobApiService.createOrUpdateLastMessage(null, 'Генерация отчета...', this._appConfig.dailyUpdateReportChatId);
    await this._cacheManager.set(getDailyRedisKey(), this._lastMessageId);
  }

  async timeout(promise: Promise<unknown>, ms: number): Promise<unknown> {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
    ]);
  }

  @Cron(AppConfig.telegramReportingCron)
  async report(chatId = this._appConfig.dailyUpdateReportChatId, lastMessageId = this._lastMessageId) {
    try {
      const results = await Promise.allSettled([
        this._analyticsService.getQueueReport(),
        this._analyticsService.getDbReport(),
        this._processingWalletsJobApiService.getWaitingCount(),
        this._telegramJobApiService.getWaitingQueueSize(),
        this._googleDriveService.getQuota()
      ].map(promise => this.timeout(promise, 60_000)));
  
      const [queueReport, dbReport, waitingCount, telegramWaitingCount, googleDriveQuota] = results.map(result => result.status === 'fulfilled' ? result.value : `Ошибка при получении данных: ${result.reason}`);
  
      const manualApiRequests = this._zerionApiService.getRequestLimits('manual');
      const updatingApiRequests = this._zerionApiService.getRequestLimits('updating');
      const manualLimits = [
        `Запросов сегодня: `,
        typeof googleDriveQuota === 'string' ? `Ошибка получения Google квоты ${googleDriveQuota}` : `Квота google drive: ${bytesToGigabytes(+(googleDriveQuota['usage'])).toFixed(2)}/${bytesToGigabytes(+googleDriveQuota['limit']).toFixed(2)} GB`,
        `Ручные запросы: ${manualApiRequests.used}/${manualApiRequests.limit}`,
        `Запросы для обновлений: ${updatingApiRequests.used}/${updatingApiRequests.limit}`,
        `Очередь отправки сообщений в telegram: ${telegramWaitingCount}`,
        `Ошибок: ${ErrorHandlingService.getErrorsCount()}`,
        `Кошельков в горячей очереди: ${waitingCount}`,
      ].join('\n');
  
      const fullReport = [
        queueReport,
        manualLimits,
        dbReport,
        `\nОбновлено: ${new Date().toLocaleDateString('RU-ru', {
          timeZone: 'Europe/Moscow',
          hour:  "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "longGeneric"
        })}`
      ].join('\n\n');
  
      const updatedLastMessageId =  await this._telegramJobApiService.createOrUpdateLastMessage(lastMessageId, fullReport, chatId);
      if (lastMessageId === this._lastMessageId && chatId === this._appConfig.dailyUpdateReportChatId) {
        this._lastMessageId = updatedLastMessageId;
        await this._cacheManager.set(getDailyRedisKey(), lastMessageId);
      }
    } catch (error) {
      Logger.log(`Error while reporting: ${error}`);
    }
    
  }
}
