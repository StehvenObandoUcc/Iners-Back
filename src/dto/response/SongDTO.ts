import { MusicSource } from '../../domain/enums/MusicSource';

export interface SongDTO {
  id: number;
  title: string;
  artist: string | null;
  album: string | null;
  year: number | null;
  genre: string | null;
  bpm: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  composer: string | null;
  durationSeconds: number | null;
  bitrate: number | null;
  sampleRate: number | null;
  replayGainTrack: number | null;
  replayGainAlbum: number | null;
  source: MusicSource;
  coverImageUrl: string | null;
  streamUrl: string;
  spotifyUri: string | null;
  isFavorite: boolean;
  hasLyrics: boolean;
  artistId: number | null;
  albumId: number | null;
}
