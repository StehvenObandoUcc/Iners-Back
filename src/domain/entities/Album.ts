import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Artist } from './Artist';
import { Song } from './Song';

@Entity('albums')
export class Album {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  coverUrl!: string | null;

  @Column({ type: 'integer', nullable: true })
  year!: number | null;

  @ManyToOne(() => Artist, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'artistId' })
  artistRef!: Artist | null;

  @Column({ nullable: true })
  artistId!: number | null;

  @OneToMany(() => Song, (song) => song.albumRef)
  songs!: Song[];

  @CreateDateColumn()
  createdAt!: Date;
}
