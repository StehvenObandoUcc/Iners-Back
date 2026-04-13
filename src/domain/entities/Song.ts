import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MusicSource } from '../enums/MusicSource';

@Entity('songs')
export class Song {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  artist!: string | null;

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
}
