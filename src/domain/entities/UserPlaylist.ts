import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlaylistSong } from './PlaylistSong';

@Entity('user_playlists')
export class UserPlaylist {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Emoji or short icon identifier, e.g. "🎸" */
  @Column({ type: 'text', nullable: true })
  emoji!: string | null;

  @OneToMany(() => PlaylistSong, (ps) => ps.playlist, { cascade: true })
  entries!: PlaylistSong[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
