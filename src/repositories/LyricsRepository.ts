import { DataSource } from 'typeorm';
import { Lyrics } from '../domain/entities/Lyrics';

export class LyricsRepository {
  private readonly repo;

  constructor(ds: DataSource) {
    this.repo = ds.getRepository(Lyrics);
  }

  async findBySongId(songId: number): Promise<Lyrics | null> {
    return this.repo.findOneBy({ songId });
  }

  async save(songId: number, lrc: string | null, plain: string | null): Promise<Lyrics> {
    const existing = await this.repo.findOneBy({ songId });
    if (existing) {
      existing.lrc   = lrc;
      existing.plain = plain;
      return this.repo.save(existing);
    }
    const entry = this.repo.create({ songId, lrc, plain });
    return this.repo.save(entry);
  }

  async deleteBySongId(songId: number): Promise<void> {
    await this.repo.delete({ songId });
  }
}
