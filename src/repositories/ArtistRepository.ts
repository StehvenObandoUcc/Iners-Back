import { DataSource, Repository } from 'typeorm';
import { MusicSource } from '../domain/enums/MusicSource';
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

  async findAllWithLocalSongs(): Promise<Artist[]> {
    return this.repo
      .createQueryBuilder('artist')
      .innerJoin('songs', 'song', 'song.artistId = artist.id AND song.source = :source', {
        source: MusicSource.LOCAL,
      })
      .orderBy('artist.name', 'ASC')
      .distinct(true)
      .getMany();
  }

  async updateImage(id: number, imageUrl: string): Promise<void> {
    await this.repo.update({ id }, { imageUrl });
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}
