import { DataSource, Repository } from 'typeorm';
import { MusicSource } from '../domain/enums/MusicSource';
import { Song } from '../domain/entities/Song';

export class SongRepository {
  private readonly repo: Repository<Song>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(Song);
  }

  async findById(id: number): Promise<Song | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findAllOrderedByPosition(): Promise<Song[]> {
    return this.repo.find({ order: { playlistPosition: 'ASC' } });
  }

  async findLocalByQuery(query: string, limit: number = 20, offset: number = 0): Promise<Song[]> {
    const normalizedQuery = `%${query.trim().toLowerCase()}%`;
    return this.repo
      .createQueryBuilder('song')
      .where('song.source = :source', { source: MusicSource.LOCAL })
      .andWhere('(LOWER(song.title) LIKE :query OR LOWER(song.artist) LIKE :query)', {
        query: normalizedQuery,
      })
      .orderBy('song.playlistPosition', 'ASC')
      .take(limit)
      .skip(offset)
      .getMany();
  }

  async findBySpotifyTrackId(trackId: string): Promise<Song | null> {
    return this.repo.findOne({ where: { spotifyTrackId: trackId } });
  }

  async findByFilePathOrUri(filePathOrUri: string): Promise<Song | null> {
    return this.repo.findOne({ where: { filePathOrUri } });
  }

  async findByIds(ids: number[]): Promise<Song[]> {
    if (ids.length === 0) return [];
    return this.repo
      .createQueryBuilder('song')
      .where('song.id IN (:...ids)', { ids })
      .getMany();
  }

  async findByArtistId(artistId: number): Promise<Song[]> {
    return this.repo.find({ where: { artistId }, order: { title: 'ASC' } });
  }

  async findByAlbumId(albumId: number): Promise<Song[]> {
    return this.repo.find({ where: { albumId }, order: { playlistPosition: 'ASC', title: 'ASC' } });
  }

  async countByArtistId(artistId: number): Promise<number> {
    return this.repo.count({ where: { artistId } });
  }

  async countByAlbumId(albumId: number): Promise<number> {
    return this.repo.count({ where: { albumId } });
  }

  async save(song: Partial<Song>): Promise<Song> {
    return this.repo.save(song);
  }

  async updatePositions(positions: Array<{ id: number; position: number }>): Promise<void> {
    if (positions.length === 0) {
      return;
    }

    await this.repo.manager.transaction(async (entityManager) => {
      for (const item of positions) {
        await entityManager.update(Song, { id: item.id }, { playlistPosition: item.position });
      }
    });
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.repo.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  async findByHash(hash: string): Promise<Song | null> {
    return this.repo.findOne({ where: { hash } });
  }

  async toggleFavorite(id: number): Promise<Song | null> {
    const song = await this.repo.findOne({ where: { id } });
    if (!song) return null;
    song.isFavorite = !song.isFavorite;
    return this.repo.save(song);
  }

  async findFavorites(): Promise<Song[]> {
    return this.repo.find({ where: { isFavorite: true }, order: { title: 'ASC' } });
  }

  async setHasLyrics(id: number, value: boolean): Promise<void> {
    await this.repo.update({ id }, { hasLyrics: value });
  }

  async updateMetadata(id: number, patch: Partial<Song>): Promise<Song | null> {
    await this.repo.update({ id }, patch);
    return this.findById(id);
  }
}
