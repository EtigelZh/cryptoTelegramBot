import { Migrations1710903030686 } from './1710903030686-migrations';
import { Migrations1710903496475 } from './1710903496475-migrations';
import { Migrations1710903598261 } from './1710903598261-migrations';
import { Migrations1714222936493 } from './1714222936493-migrations';
import { Migrations1714400814639 } from './1714400814639-migrations';
import { Migrations1714453902690 } from './1714453902690-migrations';
import { Migrations1714454032574 } from './1714454032574-migrations';
import { Migrations1714455317066 } from './1714455317066-migrations';
import { LongTermProcessing1715506426489 } from './1715506426489-long-term-processing';
import { AddBurnTransaction1715507835070 } from './1715507835070-add-burn-transaction';
import { UpdateFinancialData1715530227847 } from './1715530227847-update-financial-data';
import { AddTransactionTypes1715580298777 } from './1715580298777-add-transaction-types';
import { AddWalletStatus1715659193275 } from './1715659193275-add-wallet-status';
import { AddEthAddressToFungible1715698932109 } from './1715698932109-add-eth-address-to-fungible';
import { AddEconomicsToWallet1715765975897 } from './1715765975897-add-economics-to-wallet';
import { AddTransactionCalculationField1715772659417 } from './1715772659417-add-transaction-calculation-field';
import { Migrations1716633122382 } from './1716633122382-migrations';
import { Migrations1716655623696 } from './1716655623696-migrations';
import { Migrations1716655938772 } from './1716655938772-migrations';
import { WatchingTransactions1719833289664 } from './1719833289664-watching-transactions';
import { WatchingStats1719834487494 } from './1719834487494-watching-stats';
import { AddDexTransactions1721911710291 } from './1721911710291-add-dex-transactions';
import { AddDexOrders1723560223623 } from './1723560223623-add-dex-orders';
import { FixFungiblesPk1723560588527 } from './1723560588527-fix-fungibles-pk';
import { AddTokenPriceHistory1724141636734 } from './1724141636734-add-token-price-history';
import { FixDexOrder1724166873436 } from './1724166873436-fix-dex-order';
import { FixDexOrder1724933944698 } from './1724933944698-fix-dex-order';
import { FixDexOrderTransactionRelation1725348823129 } from './1725348823129-fix-dex-order-transaction-relation';
import { AddIdMessageDexOrder1726083802740 } from './1726083802740-add-id-message-dex-order';
import { AddDexWallets1729012757559 } from './1729012757559-add-dex-wallets';
import { FixDexOrdersStatusEnumTypo1727083802740 } from './1727083802740-fix-dex-order-status';
import { FixDexOrderChatId1730217434148 } from './1730217434148-fix-dex-order-chat-id';
import { AddDexOrderIsAutoSellEnabled1729610353605 } from './1729610353605-add-dex-order-isAutoSellEnabled';
import { AddTokenSymbol1733691778665 } from './1733691778665-add-token-symbol';
import { AddTokenForSaleFlag1733765136692 } from './1733765136692-add-token-for-sale-flag';

export const migrations = [
  Migrations1710903030686,
  Migrations1710903496475,
  Migrations1710903598261,
  Migrations1714222936493,
  Migrations1714400814639,
  Migrations1714453902690,
  Migrations1714454032574,
  Migrations1714455317066,
  LongTermProcessing1715506426489,
  AddBurnTransaction1715507835070,
  UpdateFinancialData1715530227847,
  AddTransactionTypes1715580298777,
  AddWalletStatus1715659193275,
  AddEthAddressToFungible1715698932109,
  AddEconomicsToWallet1715765975897,
  AddTransactionCalculationField1715772659417,
  Migrations1716633122382,
  Migrations1716655623696,
  Migrations1716655938772,
  WatchingTransactions1719833289664,
  WatchingStats1719834487494,
  AddDexTransactions1721911710291,
  AddDexOrders1723560223623,
  FixFungiblesPk1723560588527,
  AddTokenPriceHistory1724141636734,
  FixDexOrder1724166873436,
  FixDexOrder1724933944698,
  FixDexOrderTransactionRelation1725348823129,
  AddIdMessageDexOrder1726083802740,
  AddDexWallets1729012757559,
  FixDexOrdersStatusEnumTypo1727083802740,
  FixDexOrderChatId1730217434148,
  AddDexOrderIsAutoSellEnabled1729610353605,
  AddTokenSymbol1733691778665,
  AddTokenForSaleFlag1733765136692
];
