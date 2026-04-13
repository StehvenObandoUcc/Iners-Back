import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Song } from './Song';

@Entity('artists')
export class Artist {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  imageUrl!: string | null;

  @OneToMany(() => Song, (song) => song.artistRef)
  songs!: Song[];

  @CreateDateColumn()
  createdAt!: Date;
}
