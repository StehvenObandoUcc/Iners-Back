import { RepeatMode } from '../../domain/enums/RepeatMode';
import { SongDTO } from './SongDTO';

export interface PlaylistStateDTO {
  currentSong: SongDTO | null;
  playlist: SongDTO[];
  upNext: SongDTO[];
  history: SongDTO[];
  repeatMode: RepeatMode;
  shuffle: boolean;
}
