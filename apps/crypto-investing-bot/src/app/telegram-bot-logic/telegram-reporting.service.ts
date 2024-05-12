import { Injectable } from '@nestjs/common';

@Injectable()
export class TelegramReportingService {
  report() {
    // const summary = this._zerionApiService.getRequestLimits(apiKeyQueueName);
    // const messageText = `${globalPrefix}\nСкачано ${
    //   data.length
    // } транзакций.\nДата последней скачанной транзакции: ${data[
    // data.length - 1
    //   ]?.attributes?.mined_at?.substring(
    //   0,
    //   10
    // )}. Запросов сегодня: ${summary.used}/${summary.limit} \nПопаданий в кеш: ${cacheHitsToday}`;
    // await this._telegramJobApiService.createOrUpdateLastMessage(
    //   lastApiCallMessageId,
    //   messageText,
    //   chatId
    // );
  }
}
