import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Song } from './Song';
import { UserPlaylist } from './UserPlaylist';

@Entity('playlist_songs')
export class PlaylistSong {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => UserPlaylist, (pl) => pl.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlistId' })
  playlist!: UserPlaylist;

  @Column()
  playlistId!: number;

  @ManyToOne(() => Song, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'songId' })
  song!: Song;

  @Column()
  songId!: number;

  @Column({ default: 0 })
  position!: number;
}
