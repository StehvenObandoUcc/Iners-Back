import { MusicSource } from '../../domain/enums/MusicSource';

export interface CreateSongRequest {
  title: string;
  artist?: string | null;
  album?: string | null;
  year?: number | null;
  genre?: string | null;
  bpm?: number | null;
  trackNumber?: number | null;
  discNumber?: number | null;
  composer?: string | null;
  comment?: string | null;
  replayGainTrack?: number | null;
  replayGainAlbum?: number | null;
  bitrate?: number | null;
  sampleRate?: number | null;
  durationSeconds?: number | null;
  source?: MusicSource;
  filePathOrUri?: string | null;
  spotifyTrackId?: string | null;
  coverImageUrl?: string | null;
  playlistPosition?: number;
  hash?: string | null;
  /** Embedded or sidecar lyrics (LRC format) */
  lyricsLrc?: string | null;
  /** Embedded or sidecar plain-text lyrics */
  lyricsPlain?: string | null;
}
