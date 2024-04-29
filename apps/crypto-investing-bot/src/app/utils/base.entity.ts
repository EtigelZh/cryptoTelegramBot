import { CreateDateColumn, UpdateDateColumn } from "typeorm";
import { TIMESTAMP_COLUMN } from "./db-utils";

export abstract class WithUpdatedAndCreatedAt {
    @CreateDateColumn(TIMESTAMP_COLUMN)
    createdAt: Date;

    @UpdateDateColumn(TIMESTAMP_COLUMN)
    updatedAt: Date;
}