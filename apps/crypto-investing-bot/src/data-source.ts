import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source.options';

export default new DataSource(dataSourceOptions({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    username: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.DB_NAME,
}));