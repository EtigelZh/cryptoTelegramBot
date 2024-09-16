import { DexOrderEntity } from "../../dex-order/dex-order.entity";

export function messageDexOrder(economics: DexOrderEntity, tokenSymbol: string): string {
    const messageText = economics;
    return `${tokenSymbol} ${messageText.id}`;
}