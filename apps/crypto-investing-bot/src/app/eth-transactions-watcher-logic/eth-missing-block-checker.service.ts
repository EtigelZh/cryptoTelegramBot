import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import axios from 'axios';
// import { firstValueFrom } from 'rxjs';
// import { Cron } from '@nestjs/schedule';
// import { EthTransactionEntity } from '../eth-transfer/eth-transaction.entity';
// import { AppConfig } from '../app.config';

@Injectable()
export class EthMissingBlockCheckerService {
  // constructor(
  //   @InjectRepository(EthTransactionEntity)
  //   private readonly transactionRepository: Repository<EthTransactionEntity>,
  // ) {}

  // @Cron(AppConfig.checkMissingBlockCron)
  // async checkForMissingBlocks() {
  //   const fillMissingTransactionsGap = 7; // Days
  //   const oneWeekAgo = new Date();
  //   oneWeekAgo.setDate(oneWeekAgo.getDate() - fillMissingTransactionsGap);
  //   const unixTimestamp = Math.floor(oneWeekAgo.getTime() / 1000);

  //   const latestBlockNumber = await this.getLatestBlockNumberFromAPI(unixTimestamp);

  //   const maxBlockNumberInDB = await this.transactionRepository.query(
  //     `SELECT MAX(block_number) as max_block FROM eth_transaction`
  //   );

  //   const maxBlockNumber = maxBlockNumberInDB[0].max_block;

  //   if (maxBlockNumber < latestBlockNumber) {
  //     console.log('No missing blocks detected, latest block in DB is older than the block one week ago.');
  //     return;
  //   }

  //   const missingBlocks = await this.transactionRepository.query(
  //     `
  //     SELECT generate_series AS missing_block
  //     FROM generate_series(
  //       (SELECT MIN(block_number) FROM eth_transaction WHERE block_number >= $1),
  //       $2
  //     )
  //     EXCEPT
  //     SELECT block_number FROM eth_transaction WHERE block_number >= $1 AND block_number <= $2;
  //     `,
  //     [unixTimestamp, latestBlockNumber]
  //   );

  //   if (missingBlocks.length > 0) {
  //     console.log('Missing blocks:', missingBlocks);
  //   } else {
  //     console.log('No missing blocks found');
  //   }
  // }

  // private async getLatestBlockNumberFromAPI(timestamp: number): Promise<number> {
  //   const apiKey = 'YourApiKeyToken'; // Замените на ваш API ключ
  //   const url = `https://api.etherscan.io/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${apiKey}`;
    
  //   const response = await axios.get(url);
    
  //   if (response.data.status === '1') {
  //     return parseInt(response.data.result, 10);
  //   } else {
  //     throw new Error('Failed to fetch the block number from Etherscan API');
  //   }
  // }
}
