import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TokenPriceHistoryEntity } from "./token-price-history.entity";

@Injectable()
export class TokenPriceHistoryService {
    constructor(
        @InjectRepository(TokenPriceHistoryEntity)
        private readonly tokenPriceHistoryRepository: Repository<TokenPriceHistoryEntity>,
    ) {}

    async saveTokenPrice(
        tokenAddress: string, 
        priceInEthPerToken: number, 
        priceInTokensPerEth: number
    ): Promise<TokenPriceHistoryEntity> {
        const priceRecord = this.tokenPriceHistoryRepository.create({
            tokenAddress,
            priceInEthPerToken,
            priceInTokensPerEth,
        });
        return await this.tokenPriceHistoryRepository.save(priceRecord);
    }

    async getTokenPriceHistory(tokenAddress: string): Promise<TokenPriceHistoryEntity[]> {
        return await this.tokenPriceHistoryRepository.find({
            where: { tokenAddress },
            order: { recordedAt: 'ASC' }
        });
    }
}