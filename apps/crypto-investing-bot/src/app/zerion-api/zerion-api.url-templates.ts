export const transactionsUrlTemplate = (
  walletHash: string,
  perPage: number,
  lastTransactionDateTimestamp?: number
) =>
  `https://api.zerion.io/v1/wallets/${walletHash}/transactions/?currency=usd&page[size]=${perPage}&filter[chain_ids]=ethereum&filter[operation_types]=trade&filter[trash]=only_non_trash${lastTransactionDateTimestamp ? `&filter[min_mined_at]=${lastTransactionDateTimestamp}` : ''}`;

export const receiveTransactionsUrlTemplate = (walletHash: string, perPage: number, lastTransactionDateTimestamp?: number) =>
  `${transactionsUrlTemplate(walletHash, perPage, lastTransactionDateTimestamp).replace('filter[operation_types]=trade', 'filter[operation_types]=receive')}`;

export const fungiblePositionsUrlTemplate = (walletHash: string) =>
  `https://api.zerion.io/v1/wallets/${walletHash}/positions/?currency=usd&filter%5Btrash%5D=only_non_trash&sort=value`;


