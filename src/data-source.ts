import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Song } from './domain/entities/Song';

const isProduction = process.env.NODE_ENV === 'production';

export const dataSource = new DataSource(
  isProduction
    ? {
        type: 'postgres',
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: [Song],
        synchronize: false,
        logging: false,
      }
    : {
        type: 'better-sqlite3',
        database: process.env.DB_PATH ?? './database.sqlite',
        entities: [Song],
        synchronize: true,
        logging: false,
      },
);
