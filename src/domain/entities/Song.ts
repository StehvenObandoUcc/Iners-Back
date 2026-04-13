import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MusicSource } from '../enums/MusicSource';

// Forward-declared to avoid circular import issues at module level
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ArtistRef = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AlbumRef = any;

@Entity('songs')
export class Song {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  /** Denormalized for quick display — mirrors artistRef.name when linked */
  @Column({ type: 'text', nullable: true })
  artist!: string | null;

  /** Denormalized for quick display — mirrors albumRef.title when linked */
  @Column({ type: 'text', nullable: true })
  album!: string | null;

  @Column({ type: 'integer', nullable: true })
  durationSeconds!: number | null;

  @Column({ type: 'varchar', default: MusicSource.LOCAL })
  source!: MusicSource;

  @Column({ type: 'text', nullable: true })
  filePathOrUri!: string | null;

  @Column({ type: 'text', nullable: true })
  spotifyTrackId!: string | null;

  @Column({ type: 'text', nullable: true })
  coverImageUrl!: string | null;

  @Column({ default: 0 })
  playlistPosition!: number;

  @Column({ default: false })
  isFavorite!: boolean;

  @Column({ type: 'text', nullable: true, unique: true })
  hash!: string | null;

  // ── Extended metadata ────────────────────────────────────────────────────
  @Column({ type: 'integer', nullable: true })
  year!: number | null;

  @Column({ type: 'text', nullable: true })
  genre!: string | null;

  @Column({ type: 'integer', nullable: true })
  bpm!: number | null;

  @Column({ type: 'integer', nullable: true })
  trackNumber!: number | null;

  @Column({ type: 'integer', nullable: true })
  discNumber!: number | null;

  @Column({ type: 'text', nullable: true })
  composer!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  /** ReplayGain track gain in dB (e.g. -6.23) */
  @Column({ type: 'real', nullable: true })
  replayGainTrack!: number | null;

  /** ReplayGain album gain in dB */
  @Column({ type: 'real', nullable: true })
  replayGainAlbum!: number | null;

  /** Audio bitrate in kbps */
  @Column({ type: 'integer', nullable: true })
  bitrate!: number | null;

  /** Sample rate in Hz */
  @Column({ type: 'integer', nullable: true })
  sampleRate!: number | null;

  /** True when a Lyrics row exists for this song */
  @Column({ default: false })
  hasLyrics!: boolean;

  // ── Relations to Artist / Album ──────────────────────────────────────────
  @ManyToOne('Artist', 'songs', { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'artistId' })
  artistRef!: ArtistRef | null;

  @Column({ nullable: true })
  artistId!: number | null;

  @ManyToOne('Album', 'songs', { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'albumId' })
  albumRef!: AlbumRef | null;

  @Column({ nullable: true })
  albumId!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
