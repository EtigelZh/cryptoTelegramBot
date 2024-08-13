# CryptoInvesting

## Как начать работу над проектом

## Как настроить переменные

1. TELEGRAM_BOT_TOKEN: Токен Telegram-бота, полученный через BotFather в Telegram.

2. ZERION_API_KEY: Ключ API для доступа к ZERION, созданный в настройках платформы ZERION.

3. ZERION_UPDATING_API_KEYS: Список ключей API для обновления данных, полученных в настройках ZERION.

4. ZERION_MANUAL_API_KEYS: Ключи API для ручного доступа, полученные в настройках ZERION.

5. TARGET_GOOGLE_SHEET_DIRECTORY_ID: Идентификатор директории Google Sheets, находящийся в URL директории Google Drive.

6. TEMPLATE_GOOGLE_SHEET_ID: Идентификатор шаблона Google Sheets, находящийся в URL документа Google Sheets.

7. GOOGLE_SHEET_SERVICE_ACCOUNT_EMAIL: Email сервисного аккаунта Google.

8. GOOGLE_SHEET_CLIENT_ID: Идентификатор клиента.

9. GOOGLE_SHEET_CERTS_URL: URL для получения сертификатов, стандартный для сервисных аккаунтов Google.

10. GOOGLE_SHEET_PRIVET_KEY_ID: Идентификатор приватного ключа.

11. GOOGLE_SHEET_PRIVET_KEY: Приватный ключ для сервисного аккаунта.

12. GOOGLE_SHEET_PROJECT_ID: Идентификатор проекта в Google Cloud.

13. ADMINS_CHAT_ID: Идентификатор чата администраторов в Telegram.

14. ALCHEMY_API_KEY: Ключ API для Alchemy, созданный в разделе API на сайте Alchemy.

15. ETHERSCAN_API_KEY: Ключ API для Etherscan, созданный на сайте Etherscan.

16. REDIS_PASSWORD: Пароль для доступа к Redis, установленный при настройке сервера Redis.


## Как работать с ботом

У бота есть команды:
+ `start` - Старт
+ `transactions` - Пришли список хешей кошельков через запятую, чтобы расчитать их
+ `restart` - Рестрарт
+ `report` - Получить отчет по работе бота
+ `search_zerion` - Поиск по zerion по маестро кошельку
+ `search_etherscan` - Поиск по etherscan добавляется много кошельков по контрактам
+ `subscribe <адрес кошелька>` - Подписка на кошелек чтобы следить за его транзакциями
при отправке сообщения

Если отравить боту адресс кошелька то он создаст Excel файл с подробной аналитикой этого кошелька.

Также бот отправит ссылку на общую таблицу со всеми кошельками и обновит данные в ней.

При вводе команды `subscribe <адрес кошелька>` бот каждые 12 секунд(когда создается новый блок)начнет отпралять выполненные транзакции в этом блоке. На данный момент блок можно поменять только в коде и в файле `apps\crypto-investing-bot\src\app\eth-transactions-watcher-logic\eth-runtime-wather.service.ts` и для переменной `blockNumber` указать нужный блок

Данные о тразакциях кошелька берутся с https://app.zerion.io/ в разделе истории, отсюда же берется ID транзакции. Далее по этому ID через https://etherscan.io/ берется различная информация, например: блок транзакции
