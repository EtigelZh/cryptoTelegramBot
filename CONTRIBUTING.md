# Что нужно для старта
1. Nodejs lts currenly - 20.x.x команда проверки `node -v`
2. Git команда проверки `git version`
3. Docker и docker-compose команда проверки `docker images`

# Как работать с ветками
1. Берем тикет в работу, у него есть id
2. Из main ветки создаем бран `git checkout -b "<id_задачи>-<краткий_заголовок_задачи>" пример "24-fix-update-spreadheets-timeout", где 24 - id задачи update-spreadheets-timeout заголовок
3. Решаем локально задачу коммитим пушим в ветку
4. Создаем Merge request в main ветку когда задача готова, ставим задачу на ревью, ждем комментов
5. Если все ок, ветка льется в main и автоматом катится на тест, после того как на тесте проверяем что все ок, нажимаем кнопку выката на прод

# Предварительная настройка
1. Создаем telegram бота, что бы локально с ним работать с помощью @BotFather
2. Создаем zerion developer учетку что бы получить zerion_api_key https://developers.zerion.io/reference/intro/getting-started (На первое время можно взять тестовый токен у @andreymaznyak)
3. По пути в репозитории ./apps/crypto-investing-bot/src/assets/config создаем файлик private.env
Пример команды в unix подобной системе, так же файлик можно просто редактировать в ide:
```
echo 'TELEGRAM_BOT_TOKEN="<Токен_созданного_бота>"\nZERION_API_KEY="<dev_zerion_token>"\nADMINS_CHAT_ID="<id_юзера_из_под_которого_идет_общение_с_ботом>"' > ./apps/crypto-investing-bot/src/assets/config/private.env
```
4. Устанавливаем npm зависимости
```
npm install
```

# Начало работы
1. Запускаем нужные сервисы для работы проекта Redis и Postgres с помощью docker-compose `docker-compose up -d`
2. Запускаем бэк
```
npm start
```
3. Теперь на команду `/start` созданный бот должен начать отзываться