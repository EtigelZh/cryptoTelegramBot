# Инструкция как завести тестовый аккаунт для разработки трейдинга 

## Подготовка
1. [Создаем metamask кошелек](https://metamask.io/) - генерируем слова, сохраняем их в надежное место, получаем приватный ключ, тоже сохраняем его в надежное место
2. Закидываем не меньше 0.001 эфира на кошелек в mainnet, что бы получить тестовые эфиры в сети sepolia (тестовая сеть эфира)
3. [Получаем бесплатные тестовые эфиры](https://www.alchemy.com/faucets/ethereum-sepolia)


tsx ./apps/crypto-investing-bot/src/app/utils/crypto-core/buy-coins.github-tutor.ts --chain-id 42161  --wallet-address 0xCd4f2BACdE4E161aC0C204524fc0A58243fE447F --token-in-address 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 --token-out-address 0x0000000000000000000000000000000000000000 --amount-in 1

tsx ./apps/crypto-investing-bot/src/app/utils/crypto-core/buy-coins.github-tutor.ts --chain-id 42161  --wallet-address 0xCd4f2BACdE4E161aC0C204524fc0A58243fE447F --token-in-address 0x0000000000000000000000000000000000000000 --token-out-address 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 --amount-in 0.003