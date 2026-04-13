import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Album } from './domain/entities/Album';
import { Artist } from './domain/entities/Artist';
import { Lyrics } from './domain/entities/Lyrics';
import { PlaybackState } from './domain/entities/PlaybackState';
import { PlaylistSong } from './domain/entities/PlaylistSong';
import { Song } from './domain/entities/Song';
import { UserPlaylist } from './domain/entities/UserPlaylist';

const ENTITIES = [Song, Artist, Album, UserPlaylist, PlaylistSong, PlaybackState, Lyrics];

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
        entities: ENTITIES,
        synchronize: false,
        logging: false,
      }
    : {
        type: 'better-sqlite3',
        database: process.env.DB_PATH ?? './database.sqlite',
        entities: ENTITIES,
        synchronize: true,
        logging: false,
      },
);
