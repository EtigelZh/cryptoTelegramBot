import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppConfig } from '../app.config';
import { AnalyticsService } from '../analytics/analytics.service';
import { ZerionApiService } from '../zerion-api/zerion-api.service';
import { TelegramJobApiService } from '../telegraf/telegram-job-api.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { isNumber } from '@nestjs/common/utils/shared.utils';

function getDailyRedisKey(date = new Date()): string {
  return `daily-report-${date.toISOString().split('T')[0]}`;
}

@Injectable()
export class TelegramReportingService {
  private _lastMessageId: number;
  constructor(
    private _appConfig: AppConfig,
    private _analyticsService: AnalyticsService,
    private _zerionApiService: ZerionApiService,
    private _telegramJobApiService: TelegramJobApiService,
    @Inject(CACHE_MANAGER) private readonly _cacheManager: Cache,
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
    this._lastMessageId = await this._telegramJobApiService.createOrUpdateLastMessage(null, 'Генерация отчета...',  this._appConfig.dailyUpdateReportChatId);
    await this._cacheManager.set(getDailyRedisKey(), this._lastMessageId);
  }

  @Cron(AppConfig.telegramReportingCron)
  async report() {
    const [queueReport, dbReport] = await Promise.all([
      this._analyticsService.getQueueReport(),
      this._analyticsService.getDbReport(),
    ]);

    const manualApiRequests =  this._zerionApiService.getRequestLimits('manual');
    const updatingApiRequests =  this._zerionApiService.getRequestLimits('updating');
    const manualLimits = [
      `Запросов сегодня: `,
      `Ручные запросы: ${manualApiRequests.used}/${updatingApiRequests.limit}`,
      `Запросы для обновлений: ${updatingApiRequests.used}/${updatingApiRequests.limit}`,
    ].join('\n');

    const fullReport = [queueReport, manualLimits, dbReport].join('\n\n');

    this._lastMessageId = await this._telegramJobApiService.createOrUpdateLastMessage(this._lastMessageId, fullReport,  this._appConfig.dailyUpdateReportChatId);
    await this._cacheManager.set(getDailyRedisKey(), this._lastMessageId);
  }
}
