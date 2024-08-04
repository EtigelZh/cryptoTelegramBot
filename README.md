# CryptoInvesting

## ONBOARDING

[READ HERE](./docs/ONBOARDING.md)

## Как начать работу над проектом
1. Установить nvm
2. Поставить nodejs версии 22
3. Установить docker, docker-compose
4. Поднять необходимые сервисы для работы
`docker-compose up -d`
5. Установить npm зависимости
`npm i`
6. Скопировать файл [example.env](apps/crypto-investing-bot/src/assets/config/example.env) и назвать его private.env - заполнить переменными
`cp apps/crypto-investing-bot/src/assets/config/example.env apps/crypto-investing-bot/src/assets/config/private.env`
7. Запустить проект
`npm run start`
8. [Открыть в браузере](http://localhost:3333/)
9. Писать боту команды указанные ниже


## Migration

```
npm run migration:crypto-investing-bot --migration_name=migration-name
```

## Bot commands
```
start - Старт
transactions - Пришли список хешей кошельков через запятую, чтобы расчитать их
restart - Рестрарт
report - Получить отчет по работе бота
search_zerion - Поиск по zerion по маестро кошельку
search_etherscan - Поиск по etherscan добавляется много кошельков по контрактам 
```

