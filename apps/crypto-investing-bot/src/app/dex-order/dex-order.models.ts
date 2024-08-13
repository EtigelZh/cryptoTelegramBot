/** Статус лимитной заявки, отслеживаем только ордеры в статусe 'BUING' и 'SELLING' */
export enum DexOrderStatus {
    BUING = 'BUING',
    SELLING = 'SELLING',
    COMPLETED = 'COMPLETED'
}

export enum DexOrderCompletedReason {
    /* TRADING_PROFIT - продали по цене по которой хотели были в статусе 'SELLING' */
    TRADING_PROFIT = 'TRADING_PROFIT',
    /* MISSED_BUYING_PRICE - не успели купить, кошелек вышел мы были в статусе 'BUING' */
    MISSED_BUYING_PRICE = 'MISSED_BUYING_PRICE',
    /* MISSING_SELLING_PRICE - не достигли целевой цены */
    MISSING_SELLING_PRICE = 'MISSING_SELLING_PRICE',
    /* MANUAL - Остановленно руками */
    MANUAL = 'MANUAL'
}