import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DexOrderEntity } from "./dex-order.entity";
import { Repository } from "typeorm";

@Injectable()
export class DexOrderService {
    constructor(
        @InjectRepository(DexOrderEntity) private readonly dexOrderRepository: Repository<DexOrderEntity>
    ) {}

    async createOrder(order: DexOrderEntity) {
        return this.dexOrderRepository.save(order);
    }
}