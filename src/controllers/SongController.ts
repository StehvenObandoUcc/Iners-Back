import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { CreateSongRequest } from '../dto/request/CreateSongRequest';
import { ApiResponse } from '../dto/response/ApiResponse';
import { Song } from '../domain/entities/Song';
import { MusicSource } from '../domain/enums/MusicSource';
import { HttpError } from '../errors/HttpError';
import { LocalMusicService } from '../services/LocalMusicService';
import { SongCatalogService } from '../services/SongCatalogService';
import { SpotifyService } from '../services/SpotifyService';

export class SongController {
  constructor(
    private readonly songCatalogService: SongCatalogService,
    private readonly localMusicService: LocalMusicService,
    private readonly spotifyService: SpotifyService,
  ) {}

  async listSongs(_req: Request, res: Response): Promise<void> {
    const songs = await this.songCatalogService.listAll();
    const response: ApiResponse<Song[]> = {
      success: true,
      data: songs,
      error: null,
    };
    res.status(200).json(response);
  }

  async createSong(req: Request, res: Response): Promise<void> {
    const payload = req.body as CreateSongRequest;
    const song = await this.songCatalogService.createSong(payload);
    const response: ApiResponse<Song> = {
      success: true,
      data: song,
      error: null,
    };
    res.status(201).json(response);
  }

  async uploadMusic(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      throw new HttpError(400, 'No se encontro archivo de audio');
    }

    const musicDir = path.resolve(process.cwd(), 'music');
    if (!fs.existsSync(musicDir)) {
      fs.mkdirSync(musicDir, { recursive: true });
    }

    const originalName = path.parse(req.file.originalname).name;
    const safeName = originalName
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 80);
    const ext = path.parse(req.file.originalname).ext.toLowerCase();
    const fileName = `${safeName}${ext}`;
    const filePath = path.join(musicDir, fileName);

    // If file already exists, skip
    if (fs.existsSync(filePath)) {
      const existing = await this.songCatalogService.findByFilePathOrUri(filePath);
      if (existing) {
        res.status(200).json({
          success: true,
          data: existing,
          error: null,
        } satisfies ApiResponse<Song>);
        return;
      }
    }

    // Save the uploaded file
    fs.writeFileSync(filePath, req.file.buffer);

    // Create song in DB
    const song = await this.songCatalogService.createSong({
      title: originalName,
      artist: null,
      album: null,
      durationSeconds: null,
      source: MusicSource.LOCAL,
      filePathOrUri: `music/${fileName}`,
      spotifyTrackId: null,
      coverImageUrl: null,
    });

    const response: ApiResponse<Song> = {
      success: true,
      data: song,
      error: null,
    };
    res.status(201).json(response);
  }

  async deleteSong(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const song = await this.songCatalogService.findById(id);
    if (!song) {
      throw new HttpError(404, 'Cancion no encontrada');
    }

    // Delete file from disk if it's a local song
    if (song.source === MusicSource.LOCAL && song.filePathOrUri) {
      const fullPath = path.isAbsolute(song.filePathOrUri)
        ? song.filePathOrUri
        : path.resolve(process.cwd(), song.filePathOrUri);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    // Delete from DB
    await this.songCatalogService.deleteById(id);

    const response: ApiResponse<{ id: number }> = {
      success: true,
      data: { id },
      error: null,
    };
    res.status(200).json(response);
  }

  async seedLocalSongs(_req: Request, res: Response): Promise<void> {
    const songs = await this.songCatalogService.seedLocalSongs('music');
    const response: ApiResponse<Song[]> = {
      success: true,
      data: songs,
      error: null,
    };
    res.status(201).json(response);
  }

  async searchLocal(req: Request, res: Response): Promise<void> {
    const query = String(req.query.q ?? '').trim();
    if (!query) {
      throw new HttpError(400, 'Parametro q es obligatorio');
    }

    const limit = Math.min(Number(req.query.limit ?? 20), 100); // Max 100 results
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const songs = await this.localMusicService.search(query, limit, offset);
    const response: ApiResponse<Song[]> = {
      success: true,
      data: songs,
      error: null,
    };
    res.status(200).json(response);
  }

  async searchSpotify(req: Request, res: Response): Promise<void> {
    const query = String(req.query.q ?? '').trim();
    if (!query) {
      throw new HttpError(400, 'Parametro q es obligatorio');
    }

    if (!this.spotifyService.isAuthenticated()) {
      throw new HttpError(401, 'Spotify no autenticado');
    }

    const limit = Math.min(Number(req.query.limit ?? 20), 50); // Spotify limit: max 50
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const songs = await this.spotifyService.search(query, limit, offset);
    const response: ApiResponse<Song[]> = {
      success: true,
      data: songs,
      error: null,
    };
    res.status(200).json(response);
  }
}
