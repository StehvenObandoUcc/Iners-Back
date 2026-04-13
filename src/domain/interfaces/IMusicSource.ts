import { Song } from '../entities/Song';
import { MusicSource } from '../enums/MusicSource';

export interface IMusicSource {
  search(query: string): Promise<Song[]>;
  getStreamUrl(filePathOrUri: string): Promise<string>;
  getSourceType(): MusicSource;
}
