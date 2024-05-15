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
];
