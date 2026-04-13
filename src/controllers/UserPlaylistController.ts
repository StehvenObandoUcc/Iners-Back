import { Request, Response } from 'express';
import { ApiResponse } from '../dto/response/ApiResponse';
import { Song } from '../domain/entities/Song';
import { UserPlaylist } from '../domain/entities/UserPlaylist';
import { HttpError } from '../errors/HttpError';
import { UserPlaylistRepository } from '../repositories/UserPlaylistRepository';
import { PlaylistService } from '../services/PlaylistService';
import { SongCatalogService } from '../services/SongCatalogService';

export class UserPlaylistController {
  constructor(
    private readonly userPlaylistRepo: UserPlaylistRepository,
    private readonly playlistService: PlaylistService,
    private readonly songCatalogService: SongCatalogService,
  ) {}

  async listPlaylists(_req: Request, res: Response): Promise<void> {
    const playlists = await this.userPlaylistRepo.findAll();
    res.status(200).json({ success: true, data: playlists, error: null } satisfies ApiResponse<UserPlaylist[]>);
  }

  async getPlaylist(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const pl = await this.userPlaylistRepo.findById(id);
    if (!pl) throw new HttpError(404, 'Playlist no encontrada');
    res.status(200).json({ success: true, data: pl, error: null } satisfies ApiResponse<UserPlaylist>);
  }

  async createPlaylist(req: Request, res: Response): Promise<void> {
    const { name, description, emoji } = req.body as { name?: string; description?: string; emoji?: string };
    if (!name?.trim()) throw new HttpError(400, 'El nombre de la playlist es obligatorio');
    const pl = await this.userPlaylistRepo.create(name.trim(), description ?? null, emoji ?? null);
    res.status(201).json({ success: true, data: pl, error: null } satisfies ApiResponse<UserPlaylist>);
  }

  async updatePlaylist(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const patch = req.body as Partial<{ name: string; description: string; emoji: string }>;
    const updated = await this.userPlaylistRepo.update(id, patch);
    if (!updated) throw new HttpError(404, 'Playlist no encontrada');
    res.status(200).json({ success: true, data: updated, error: null } satisfies ApiResponse<UserPlaylist>);
  }

  async deletePlaylist(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const pl = await this.userPlaylistRepo.findById(id);
    if (!pl) throw new HttpError(404, 'Playlist no encontrada');

    const songIds = await this.userPlaylistRepo.getSongIds(id);
    await this.userPlaylistRepo.delete(id);

    for (const songId of songIds) {
      await this.songCatalogService.deleteIfOrphaned(songId);
    }

    res.status(200).json({ success: true, data: { id }, error: null } satisfies ApiResponse<{ id: number }>);
  }

  async getPlaylistSongs(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const songs = await this.userPlaylistRepo.getSongs(id);
    res.status(200).json({ success: true, data: songs, error: null } satisfies ApiResponse<Song[]>);
  }

  async addSong(req: Request, res: Response): Promise<void> {
    const playlistId = Number(req.params.id);
    const { songId } = req.body as { songId?: number };
    if (!songId) throw new HttpError(400, 'songId es obligatorio');
    await this.userPlaylistRepo.addSong(playlistId, songId);
    const songs = await this.userPlaylistRepo.getSongs(playlistId);
    res.status(200).json({ success: true, data: songs, error: null } satisfies ApiResponse<Song[]>);
  }

  async removeSong(req: Request, res: Response): Promise<void> {
    const playlistId = Number(req.params.id);
    const songId = Number(req.params.songId);
    await this.userPlaylistRepo.removeSong(playlistId, songId);

    await this.songCatalogService.deleteIfOrphaned(songId);

    const songs = await this.userPlaylistRepo.getSongs(playlistId);
    res.status(200).json({ success: true, data: songs, error: null } satisfies ApiResponse<Song[]>);
  }

  /** Load all songs in this playlist into the player queue, clearing the current queue. */
  async loadIntoPlayer(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const pl = await this.userPlaylistRepo.findById(id);
    if (!pl) throw new HttpError(404, 'Playlist no encontrada');

    const songs = await this.userPlaylistRepo.getSongs(id);
    if (songs.length === 0) throw new HttpError(400, 'La playlist esta vacia');

    // Clear current queue and load these songs
    const stateDTO = await this.playlistService.loadUserPlaylist(songs);
    res.status(200).json({ success: true, data: stateDTO, error: null });
  }
}
