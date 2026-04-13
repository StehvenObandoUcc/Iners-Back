import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';

/**
 * Stores lyrics for a song.  Uses songId as PK (one-to-one).
 * Kept in a separate table so the main Song row stays lean.
 */
@Entity('lyrics')
export class Lyrics {
  @PrimaryColumn()
  songId!: number;

  @OneToOne('Song', { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'songId' })
  song!: unknown;

  /** LRC-formatted lyrics (timestamped, e.g. "[00:12.34] text") */
  @Column({ type: 'text', nullable: true })
  lrc!: string | null;

  /** Plain-text lyrics (no timestamps) */
  @Column({ type: 'text', nullable: true })
  plain!: string | null;
}
