import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FinanceDataEntity } from './financial-data.entity';
import { Repository } from 'typeorm';
import { FinanceData } from '../google-api/google-sheets/google-sheets.models';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { RedisStore } from 'cache-manager-redis-store';

export enum ReportingPeriod {
  hour = 'hour',
  day = 'day',
  week = 'week',
  month = 'month',
}

export enum Metric {
  processedWallets = 'processedWallets',
  zerionRequests = 'zerionRequests',
  googleSheetsRequests = 'googleSheetsRequests',
  googleDriveRequests = 'googleDriveRequests',
}

export function humanizeMetric(metric: Metric): string {
  switch (metric) {
    case Metric.processedWallets:
      return 'Обработано кошельков';
    case Metric.zerionRequests:
      return 'Запросов в Zerion';
    case Metric.googleSheetsRequests:
      return 'Запросов в Google Sheets';
    case Metric.googleDriveRequests:
      return 'Запросов в Google Drive';
  }
}

export function humanizePeriod(period: ReportingPeriod, now = new Date()): string {
  const hourFormatter = new Intl.DateTimeFormat('ru-RU', { hour: 'numeric', hour12: false });
  const dayFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric' });
  const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long' });

  switch (period) {
    case ReportingPeriod.hour:
      // Display the hour in 24-hour format
      return `Час ${hourFormatter.format(now)}`;
    case ReportingPeriod.day:
      // Display only the day of the month
      return `День ${dayFormatter.format(now)}`;
    case ReportingPeriod.week: {
      // For week, calculate the start and end of the week and display as a range of days
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return `Неделя ${dayFormatter.format(startOfWeek)} - ${dayFormatter.format(endOfWeek)}`;
    }

    case ReportingPeriod.month:
      // Display only the name of the month
      return `Месяц ${monthFormatter.format(now)}`;
  }
}

export function createMetricRedisKey(metric: Metric, period: ReportingPeriod, now = new Date()) {
  return `reporting:${metric}:${period}:${createKeyForPeriod(period, now)}`;
}

export function createKeyForPeriod(period: ReportingPeriod, now = new Date()) {
  switch (period) {
    case ReportingPeriod.hour:
      return now.toISOString().substring(0, 13); // YYYY-MM-DDTHH
    case ReportingPeriod.day:
      return now.toISOString().substring(0, 10); // YYYY-MM-DD
    case ReportingPeriod.week:
      // get first day of current week (assuming Sunday as start of week)
      return new Date(now.setDate(now.getDate() - now.getDay())).toISOString().substring(0, 10); // YYYY-MM-DD
    case ReportingPeriod.month:
      return now.toISOString().substring(0, 7); // YYYY-MM
  }
}

export function createKeyForPreviousPeriod(metric: Metric, period: ReportingPeriod, previousPeriodKey: string) {
  const previousDate = previousPeriodKey.split(':').pop();
  const stringDate = new Date(padIsoStringDate(period, previousDate));
  const previousPeriodDate = getPreviousPeriodDate(stringDate, period);
  return createMetricRedisKey(metric, period, previousPeriodDate);
}

export function getPreviousPeriodDate(currentDate: Date, period: ReportingPeriod): Date {
  switch (period) {
    case ReportingPeriod.hour:
      return new Date(currentDate.setHours(currentDate.getHours() - 1));
    case ReportingPeriod.day:
      return new Date(currentDate.setDate(currentDate.getDate() - 1));
    case ReportingPeriod.week:
      return new Date(currentDate.setDate(currentDate.getDate() - 7));
    case ReportingPeriod.month:
      return new Date(currentDate.setMonth(currentDate.getMonth() - 1));
  }
}

export function padIsoStringDate(period: ReportingPeriod, date: string): string {
  switch (period) {
    case ReportingPeriod.hour:
      return date + ':00:00';
    case ReportingPeriod.day:
      return date + 'T00:00:00';
    case ReportingPeriod.week:
      return date + 'T00:00:00';
    case ReportingPeriod.month:
      return date + '-01T00:00:00';
  }
}


@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(FinanceDataEntity) private _repository: Repository<FinanceDataEntity>,
    @Inject(CACHE_MANAGER) private _cacheManager: Cache
  ) {
  }

  async saveFinancialData(data: FinanceData) {
    return await this._repository.save(data);
  }

  async incrementMetric(metric: Metric): Promise<void> {
    const allKeys = Object.values(ReportingPeriod).map(period => ({
      key: createMetricRedisKey(metric, period),
      period
    }));
    await Promise.allSettled(allKeys.map(({ key }) => this._getRedisClient().incr(key)));
  }

  async getMetricByPeriod(metric: Metric, period: ReportingPeriod, now = new Date()): Promise<number> {
    return parseInt(await this._getRedisClient().get(createMetricRedisKey(metric, period, now)) || '0', 10);
  }

  async getMetricAllPeriods(metric: Metric): Promise<Record<ReportingPeriod, number>> {
    const allKeys = Object.values(ReportingPeriod).map(period => ({
      key: createMetricRedisKey(metric, period),
      period
    }));
    const results = await Promise.all(allKeys.map(async ({ key, period }) => ({
      period,
      value: parseInt(await this._getRedisClient().get(key) || '0', 10)
    })));

    return results.reduce((acc, { period, value }) => ({
      ...acc,
      [period]: value
    }), {} as Record<ReportingPeriod, number>);
  }

  async getDiffForPeriod(metric: Metric, period: ReportingPeriod): Promise<number> {
    const currentPeriodKey = createMetricRedisKey(metric, period);
    const previousPeriodKey = createKeyForPreviousPeriod(metric, period, currentPeriodKey);
    const [currentPeriod, previousPeriod] = await Promise.all([
      this._getRedisClient().get(currentPeriodKey).then(value => parseInt(value || '0', 10)),
      this._getRedisClient().get(previousPeriodKey).then(value => parseInt(value || '0', 10))
    ]);

    return currentPeriod - previousPeriod;
  }

  async getQueueReport(): Promise<string> {
    const metrics = Object.values(Metric);
    const periods = Object.values(ReportingPeriod);
    const now = new Date();
    const allMetrics = await Promise.all(metrics.map(async metric => {
      const metricValues = await Promise.all(periods.map(period => Promise.all([
        this.getMetricByPeriod(metric, period, now),
        this.getDiffForPeriod(metric, period)
      ])));
      return `${humanizeMetric(metric)}:\n${periods.map((period, index) => `\t\t${humanizePeriod(period, now)}: ${metricValues[index][0]} +(${metricValues[index][1]})`).join('\n')}`;
    }));

    return allMetrics.join('\n\n');
  }

  async getDbReport(): Promise<string> {
    const data = await this._repository.query(`
      SELECT
        COUNT(fd.id),
        'Excel таблиц расчитано' kind
      FROM finance_datas fd
      UNION
      SELECT
        COUNT(f.symbol),
        'Типов ERC-20 токенов' kind
      FROM fungibles f
      UNION
      SELECT
        COUNT(ltpw.id),
        'Кошельков в ожидании пересчета' kind
      FROM long_term_processing_wallet_tasks ltpw
      WHERE is_finished = FALSE AND ltpw.processed_at IS NOT NULL
      UNION
      SELECT
        COUNT(t.id),
        'Скачано транзакций'
      FROM transactions t
      UNION
      SELECT
        COUNT(tr.*),
        'Скачано ERC-20 трансферов'
      FROM transfers tr
      UNION
      SELECT
        COUNT(w.*),
        'Кошельков в базе'
      FROM wallets w
    `);
    return data.map(({count, kind}) => `${kind}: ${count}`).join('\n');
  }

  private _getRedisClient() {
    return (this._cacheManager.store as unknown as RedisStore).getClient();
  }
}
