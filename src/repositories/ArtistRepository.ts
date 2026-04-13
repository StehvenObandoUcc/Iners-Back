import { DataSource, Repository } from 'typeorm';
import { Artist } from '../domain/entities/Artist';

export class ArtistRepository {
  private readonly repo: Repository<Artist>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(Artist);
  }

  async findById(id: number): Promise<Artist | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByName(name: string): Promise<Artist | null> {
    return this.repo.findOne({ where: { name } });
  }

  /** Find or create an artist by exact name (case-insensitive). */
  async findOrCreate(name: string): Promise<Artist> {
    const normalized = name.trim();
    const existing = await this.repo
      .createQueryBuilder('a')
      .where('LOWER(a.name) = LOWER(:name)', { name: normalized })
      .getOne();
    if (existing) return existing;
    const artist = this.repo.create({ name: normalized });
    return this.repo.save(artist);
  }

  async findAll(): Promise<Artist[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async updateImage(id: number, imageUrl: string): Promise<void> {
    await this.repo.update({ id }, { imageUrl });
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}
