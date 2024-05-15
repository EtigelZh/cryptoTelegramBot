import type { Transfer, ZerionTransaction } from "../zerion-api/zerion-api.models";
import type { AmountGroup, CurrencySymbol, InOutTransactionFields } from "./models";

export function calculateInOutTransferByZerionTransaction(zerionTransaction: ZerionTransaction): InOutTransactionFields {
    const buyTransfers = zerionTransaction?.attributes?.transfers?.filter((transfer) => transfer?.direction === 'in') || [];
    const buyAmounts = groupTransfersByCurrency(buyTransfers);
    // TODO доработать этот механизм -> обработать кейсы покупок за стейблкоины и другие токены
    const buyAmount = maxCurrencyAmount(buyAmounts);

    const sellTransfers = zerionTransaction?.attributes?.transfers?.filter((transfer) => transfer?.direction === 'in') || [];
    const sellAmounts = groupTransfersByCurrency(sellTransfers)
    const sellAmount = maxCurrencyAmount(sellAmounts);

    return {
        receiveAmount: buyAmount?.amount || 0,
        receiveCurrency: buyAmount?.amountCurrency || '',
        receiveUsd: buyAmount?.amountUsd || null,
        receiveUsdRate: buyAmount?.amountUsdRate || null,

        spentAmount: sellAmount?.amount || 0,
        spentCurrency: sellAmount?.amountCurrency || '',
        spentUsd: sellAmount?.amountUsd || null,
        spentUsdRate: sellAmount?.amountUsdRate || null,
    }

}

function groupTransfersByCurrency(transfers: Transfer[]): Record<CurrencySymbol, AmountGroup> {
    return transfers.reduce((acc, transfer) => {
        const amountCurrency: CurrencySymbol = transfer.fungible_info?.symbol || '';
        if (!acc[amountCurrency]) {
            acc[amountCurrency] = {
                amount: +transfer.quantity?.numeric,
                amountCurrency,
                amountUsd: transfer.value || null,
                amountUsdRate: transfer.price || null,
            };
        } else {
            acc[amountCurrency].amount += +(transfer.quantity?.numeric || 0);
            acc[amountCurrency].amountUsd += transfer.value || 0;
        }

        return acc;
    }, {} as Record<CurrencySymbol, AmountGroup>);
}

function maxCurrencyAmount(amounts: Record<CurrencySymbol, AmountGroup>): AmountGroup {
    const values = Object.values(amounts);
    if (!values.length) {
        return {
            amount: 0,
            amountCurrency:'',
            amountUsd: null,
            amountUsdRate: null,
        };
    }
    return values.reduce((max, current) => {
        if (max.amountUsd && current.amountUsd) {
            return max.amountUsd < current.amountUsd ? current : max
        } else if (max.amountUsd && !current.amountUsd) {
            return max;
        } else if (!max.amountUsd && current.amountUsd) {
            return current;
        } else {
            return max.amount < current.amount ? current : max;
        }
    });
}
