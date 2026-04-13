import { createReadStream, ReadStream } from 'node:fs';
import { IMusicSource } from '../domain/interfaces/IMusicSource';
import { MusicSource } from '../domain/enums/MusicSource';
import { Song } from '../domain/entities/Song';
import { SongRepository } from '../repositories/SongRepository';

export class LocalMusicService implements IMusicSource {
  constructor(private readonly songRepo: SongRepository) {}

  async search(query: string, limit: number = 20, offset: number = 0): Promise<Song[]> {
    return this.songRepo.findLocalByQuery(query, limit, offset);
  }

  async getStreamUrl(_filePath: string): Promise<string> {
    return '/api/player/stream';
  }

  getSourceType(): MusicSource {
    return MusicSource.LOCAL;
  }

  getAudioResource(filePath: string): ReadStream {
    return createReadStream(filePath);
  }
}
