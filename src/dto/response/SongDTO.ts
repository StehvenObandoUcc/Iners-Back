import { MusicSource } from '../../domain/enums/MusicSource';

export interface SongDTO {
  id: number;
  title: string;
  artist: string | null;
  album: string | null;
  durationSeconds: number | null;
  source: MusicSource;
  coverImageUrl: string | null;
  streamUrl: string;
}
