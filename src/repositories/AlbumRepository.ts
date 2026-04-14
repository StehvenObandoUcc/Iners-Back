import { DataSource, Repository } from 'typeorm';
import { MusicSource } from '../domain/enums/MusicSource';
import { Album } from '../domain/entities/Album';

export class AlbumRepository {
  private readonly repo: Repository<Album>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(Album);
  }

  async findById(id: number): Promise<Album | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** Find or create an album by title + artistId (nullable). */
  async findOrCreate(title: string, artistId: number | null, year?: number | null, coverUrl?: string | null): Promise<Album> {
    const normalized = title.trim();

    const qb = this.repo
      .createQueryBuilder('a')
      .where('LOWER(a.title) = LOWER(:title)', { title: normalized });

    if (artistId !== null) {
      qb.andWhere('a.artistId = :artistId', { artistId });
    } else {
      qb.andWhere('a.artistId IS NULL');
    }

    const existing = await qb.getOne();
    if (existing) {
      // Update cover/year if we now have them and didn't before
      let changed = false;
      if (!existing.coverUrl && coverUrl) { existing.coverUrl = coverUrl; changed = true; }
      if (!existing.year && year)         { existing.year = year;         changed = true; }
      return changed ? this.repo.save(existing) : existing;
    }

    const album = this.repo.create({ title: normalized, artistId, year: year ?? null, coverUrl: coverUrl ?? null });
    return this.repo.save(album);
  }

  async findAllWithLocalSongs(): Promise<Album[]> {
    return this.repo
      .createQueryBuilder('album')
      .innerJoin('songs', 'song', 'song.albumId = album.id AND song.source = :source', {
        source: MusicSource.LOCAL,
      })
      .orderBy('album.title', 'ASC')
      .distinct(true)
      .getMany();
  }

  async findByArtistWithLocalSongs(artistId: number): Promise<Album[]> {
    return this.repo
      .createQueryBuilder('album')
      .innerJoin('songs', 'song', 'song.albumId = album.id AND song.source = :source', {
        source: MusicSource.LOCAL,
      })
      .where('album.artistId = :artistId', { artistId })
      .orderBy('album.year', 'DESC')
      .addOrderBy('album.title', 'ASC')
      .distinct(true)
      .getMany();
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}
