import { Request, Response } from 'express';
import { ApiResponse } from '../dto/response/ApiResponse';
import { Album } from '../domain/entities/Album';
import { Song } from '../domain/entities/Song';
import { HttpError } from '../errors/HttpError';
import { AlbumRepository } from '../repositories/AlbumRepository';
import { SongRepository } from '../repositories/SongRepository';
import { SongCatalogService } from '../services/SongCatalogService';

export class AlbumController {
  constructor(
    private readonly albumRepo: AlbumRepository,
    private readonly songRepo: SongRepository,
    private readonly songCatalogService: SongCatalogService,
  ) {}

  async listAlbums(_req: Request, res: Response): Promise<void> {
    const albums = await this.albumRepo.findAll();
    res.status(200).json({ success: true, data: albums, error: null } satisfies ApiResponse<Album[]>);
  }

  async getAlbum(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const album = await this.albumRepo.findById(id);
    if (!album) throw new HttpError(404, 'Album no encontrado');
    res.status(200).json({ success: true, data: album, error: null } satisfies ApiResponse<Album>);
  }

  async getAlbumSongs(req: Request, res: Response): Promise<void> {
    const albumId = Number(req.params.id);
    const album = await this.albumRepo.findById(albumId);
    if (!album) throw new HttpError(404, 'Album no encontrado');
    const songs = await this.songRepo.findByAlbumId(albumId);
    res.status(200).json({ success: true, data: songs, error: null } satisfies ApiResponse<Song[]>);
  }

  async getByArtist(req: Request, res: Response): Promise<void> {
    const artistId = Number(req.params.artistId);
    const albums = await this.albumRepo.findByArtist(artistId);
    res.status(200).json({ success: true, data: albums, error: null } satisfies ApiResponse<Album[]>);
  }

  async deleteAlbum(req: Request, res: Response): Promise<void> {
    const albumId = Number(req.params.id);
    const album = await this.albumRepo.findById(albumId);
    if (!album) throw new HttpError(404, 'Album no encontrado');

    const songs = await this.songRepo.findByAlbumId(albumId);
    for (const song of songs) {
      await this.songCatalogService.deleteFullyById(song.id);
    }

    await this.albumRepo.delete(albumId);
    res.status(200).json({ success: true, data: { id: albumId }, error: null } satisfies ApiResponse<{ id: number }>);
  }
}
