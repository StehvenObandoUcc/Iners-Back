import { Column, Entity, PrimaryColumn } from 'typeorm';
import { RepeatMode } from '../enums/RepeatMode';

/**
 * Singleton row (id = 1). Persists the full player state across server restarts.
 * queueIds / historyIds / upNextIds are stored as JSON-encoded number arrays.
 */
@Entity('playback_state')
export class PlaybackState {
  @PrimaryColumn()
  id!: number;

  @Column({ type: 'integer', nullable: true })
  currentSongId!: number | null;

  /** JSON array of song IDs representing the doubly-linked queue order */
  @Column({ type: 'text', default: '[]' })
  queueIds!: string;

  /** JSON array of song IDs (most recent last) */
  @Column({ type: 'text', default: '[]' })
  historyIds!: string;

  /** JSON array of song IDs */
  @Column({ type: 'text', default: '[]' })
  upNextIds!: string;

  @Column({ type: 'varchar', default: RepeatMode.NONE })
  repeatMode!: RepeatMode;

  @Column({ default: false })
  shuffle!: boolean;

  @Column({ type: 'integer', default: Date.now() })
  updatedAt!: number;
}
