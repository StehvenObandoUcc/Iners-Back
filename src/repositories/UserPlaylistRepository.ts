import { DataSource, Repository } from 'typeorm';
import { PlaylistSong } from '../domain/entities/PlaylistSong';
import { Song } from '../domain/entities/Song';
import { UserPlaylist } from '../domain/entities/UserPlaylist';

export class UserPlaylistRepository {
  private readonly plRepo: Repository<UserPlaylist>;
  private readonly psRepo: Repository<PlaylistSong>;

  constructor(dataSource: DataSource) {
    this.plRepo = dataSource.getRepository(UserPlaylist);
    this.psRepo = dataSource.getRepository(PlaylistSong);
  }

  async findAll(): Promise<UserPlaylist[]> {
    return this.plRepo.find({ order: { name: 'ASC' } });
  }

  async findById(id: number): Promise<UserPlaylist | null> {
    return this.plRepo.findOne({ where: { id } });
  }

  async create(name: string, description?: string | null, emoji?: string | null): Promise<UserPlaylist> {
    const pl = this.plRepo.create({ name: name.trim(), description: description ?? null, emoji: emoji ?? null });
    return this.plRepo.save(pl);
  }

  async update(id: number, patch: Partial<Pick<UserPlaylist, 'name' | 'description' | 'emoji'>>): Promise<UserPlaylist | null> {
    await this.plRepo.update({ id }, patch);
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    await this.plRepo.delete({ id });
  }

  /** Returns ordered songs for a playlist. */
  async getSongs(playlistId: number): Promise<Song[]> {
    const entries = await this.psRepo.find({
      where: { playlistId },
      relations: ['song'],
      order: { position: 'ASC' },
    });
    return entries.map((e) => e.song);
  }

  async getSongIds(playlistId: number): Promise<number[]> {
    const rows = await this.psRepo.find({
      where: { playlistId },
      select: { songId: true },
      order: { position: 'ASC' },
    });
    return rows.map((row) => row.songId);
  }

  async addSong(playlistId: number, songId: number): Promise<void> {
    // Prevent duplicates
    const exists = await this.psRepo.findOne({ where: { playlistId, songId } });
    if (exists) return;

    const maxPos = await this.psRepo
      .createQueryBuilder('ps')
      .select('MAX(ps.position)', 'max')
      .where('ps.playlistId = :playlistId', { playlistId })
      .getRawOne<{ max: number | null }>();

    const position = (maxPos?.max ?? -1) + 1;
    await this.psRepo.save(this.psRepo.create({ playlistId, songId, position }));
  }

  async removeSong(playlistId: number, songId: number): Promise<void> {
    await this.psRepo.delete({ playlistId, songId });
  }

  async isSongReferenced(songId: number): Promise<boolean> {
    const refs = await this.psRepo.count({ where: { songId } });
    return refs > 0;
  }
}
