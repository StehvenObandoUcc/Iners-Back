import { DataSource, Repository } from 'typeorm';
import { PlaybackState } from '../domain/entities/PlaybackState';
import { RepeatMode } from '../domain/enums/RepeatMode';

const SINGLETON_ID = 1;

export interface PersistedState {
  currentSongId: number | null;
  queueIds: number[];
  historyIds: number[];
  upNextIds: number[];
  repeatMode: RepeatMode;
  shuffle: boolean;
}

export class PlaybackStateRepository {
  private readonly repo: Repository<PlaybackState>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(PlaybackState);
  }

  async load(): Promise<PersistedState | null> {
    const row = await this.repo.findOne({ where: { id: SINGLETON_ID } });
    if (!row) return null;

    return {
      currentSongId: row.currentSongId,
      queueIds:   this.parseIds(row.queueIds),
      historyIds: this.parseIds(row.historyIds),
      upNextIds:  this.parseIds(row.upNextIds),
      repeatMode: row.repeatMode,
      shuffle:    row.shuffle,
    };
  }

  async save(state: PersistedState): Promise<void> {
    const row: Partial<PlaybackState> = {
      id: SINGLETON_ID,
      currentSongId: state.currentSongId,
      queueIds:   JSON.stringify(state.queueIds),
      historyIds: JSON.stringify(state.historyIds),
      upNextIds:  JSON.stringify(state.upNextIds),
      repeatMode: state.repeatMode,
      shuffle:    state.shuffle,
      updatedAt:  Date.now(),
    };
    await this.repo.save(row);
  }

  private parseIds(raw: string): number[] {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as unknown[]).filter(Number.isInteger) as number[] : [];
    } catch {
      return [];
    }
  }
}
