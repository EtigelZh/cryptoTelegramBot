import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FinanceDataEntity } from "./financial-data.entity";
import { Repository } from "typeorm";
import { FinanceData } from "../google-sheet/google-sheets/google-sheets.models";

@Injectable()
export class AnalyticsService {
    constructor(
        @InjectRepository(FinanceDataEntity) private _repository: Repository<FinanceDataEntity>,
    ) {}

    async saveFinancialData(data: FinanceData) {
        return await this._repository.save(data);
    }
}