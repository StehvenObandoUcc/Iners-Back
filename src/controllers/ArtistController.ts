import { Request, Response } from 'express';
import { ApiResponse } from '../dto/response/ApiResponse';
import { Artist } from '../domain/entities/Artist';
import { Song } from '../domain/entities/Song';
import { HttpError } from '../errors/HttpError';
import { ArtistRepository } from '../repositories/ArtistRepository';
import { SongRepository } from '../repositories/SongRepository';

export class ArtistController {
  constructor(
    private readonly artistRepo: ArtistRepository,
    private readonly songRepo: SongRepository,
  ) {}

  async listArtists(_req: Request, res: Response): Promise<void> {
    const artists = await this.artistRepo.findAllWithLocalSongs();
    res.status(200).json({ success: true, data: artists, error: null } satisfies ApiResponse<Artist[]>);
  }

  async getArtist(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const artist = await this.artistRepo.findById(id);
    const localSongCount = artist ? await this.songRepo.countLocalByArtistId(id) : 0;
    if (!artist || localSongCount === 0) throw new HttpError(404, 'Artista no encontrado');
    res.status(200).json({ success: true, data: artist, error: null } satisfies ApiResponse<Artist>);
  }

  async getArtistSongs(req: Request, res: Response): Promise<void> {
    const artistId = Number(req.params.id);
    const artist = await this.artistRepo.findById(artistId);
    const localSongCount = artist ? await this.songRepo.countLocalByArtistId(artistId) : 0;
    if (!artist || localSongCount === 0) throw new HttpError(404, 'Artista no encontrado');
    const songs = await this.songRepo.findLocalByArtistId(artistId);
    res.status(200).json({ success: true, data: songs, error: null } satisfies ApiResponse<Song[]>);
  }
}
