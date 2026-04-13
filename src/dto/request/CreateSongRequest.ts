import { MusicSource } from '../../domain/enums/MusicSource';

export interface CreateSongRequest {
  title: string;
  artist?: string | null;
  album?: string | null;
  durationSeconds?: number | null;
  source?: MusicSource;
  filePathOrUri?: string | null;
  spotifyTrackId?: string | null;
  coverImageUrl?: string | null;
  playlistPosition?: number;
}
