import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { ApiResponse } from '../dto/response/ApiResponse';
import { PlaylistStateDTO } from '../dto/response/PlaylistStateDTO';
import { SongDTO } from '../dto/response/SongDTO';
import { RepeatMode } from '../domain/enums/RepeatMode';
import { HttpError } from '../errors/HttpError';
import { SongRepository } from '../repositories/SongRepository';
import { LocalMusicService } from '../services/LocalMusicService';
import { PlayerStateService } from '../services/PlayerStateService';
import { PlaylistService } from '../services/PlaylistService';

const MIME_BY_EXT: Record<string, string> = {
  '.mp3':  'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav':  'audio/wav',
  '.ogg':  'audio/ogg',
  '.m4a':  'audio/mp4',
  '.aac':  'audio/aac',
};

export class PlayerController {
  constructor(
    private readonly playlistService: PlaylistService,
    private readonly playerStateService: PlayerStateService,
    private readonly localMusicService: LocalMusicService,
    private readonly songRepo: SongRepository,
  ) {}

  async nextSong(_req: Request, res: Response): Promise<void> {
    const state = await this.playlistService.next();
    const response: ApiResponse<PlaylistStateDTO> = { success: true, data: state, error: null };
    res.status(200).json(response);
  }

  async previousSong(_req: Request, res: Response): Promise<void> {
    const state = await this.playlistService.previous();
    const response: ApiResponse<PlaylistStateDTO> = { success: true, data: state, error: null };
    res.status(200).json(response);
  }

  async play(_req: Request, res: Response): Promise<void> {
    // isPlaying is frontend state — backend just returns current playlist state
    const state = await this.playlistService.getState();
    const response: ApiResponse<PlaylistStateDTO> = { success: true, data: state, error: null };
    res.status(200).json(response);
  }

  async pause(_req: Request, res: Response): Promise<void> {
    // isPlaying is frontend state — backend just returns current playlist state
    const state = await this.playlistService.getState();
    const response: ApiResponse<PlaylistStateDTO> = { success: true, data: state, error: null };
    res.status(200).json(response);
  }

  async setRepeatMode(req: Request, res: Response): Promise<void> {
    const mode = req.body.mode as RepeatMode;
    if (!Object.values(RepeatMode).includes(mode)) {
      throw new HttpError(400, 'Repeat mode invalido');
    }

    this.playerStateService.setRepeatMode(mode);
    const response: ApiResponse<{ repeatMode: RepeatMode }> = {
      success: true,
      data: { repeatMode: mode },
      error: null,
    };
    res.status(200).json(response);
  }

  async playNow(req: Request, res: Response): Promise<void> {
    const songId = Number(req.params.id);
    const state = await this.playlistService.playNow(songId);
    const response: ApiResponse<PlaylistStateDTO> = { success: true, data: state, error: null };
    res.status(200).json(response);
  }

  async getCurrent(_req: Request, res: Response): Promise<void> {
    const song = await this.playlistService.getCurrentSong();

    const response: ApiResponse<SongDTO | null> = {
      success: true,
      data: song,
      error: null,
    };
    res.status(200).json(response);
  }

  async streamAudio(req: Request, res: Response): Promise<void> {
    const songId = Number(req.params.id);
    const song = await this.songRepo.findById(songId);
    if (!song) throw new HttpError(404, 'Cancion no encontrada');
    if (!song.filePathOrUri) throw new HttpError(400, 'La cancion no tiene ruta local');

    const absolutePath = path.isAbsolute(song.filePathOrUri)
      ? song.filePathOrUri
      : path.resolve(process.cwd(), song.filePathOrUri);

    if (!fs.existsSync(absolutePath)) {
      throw new HttpError(404, 'Archivo de audio no encontrado en disco');
    }

    const stat = fs.statSync(absolutePath);
    const fileSize = stat.size;
    const ext = path.extname(absolutePath).toLowerCase();
    const mimeType = MIME_BY_EXT[ext] ?? 'audio/mpeg';

    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      // Parse Range: bytes=start-end
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunkSize,
        'Content-Type':   mimeType,
      });

      fs.createReadStream(absolutePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type':   mimeType,
        'Accept-Ranges':  'bytes',
      });
      fs.createReadStream(absolutePath).pipe(res);
    }
  }

  async toggleShuffle(_req: Request, res: Response): Promise<void> {
    const newVal = !this.playerStateService.isShuffle();
    const state = await this.playlistService.setShuffle(newVal);
    const response: ApiResponse<PlaylistStateDTO> = { success: true, data: state, error: null };
    res.status(200).json(response);
  }
}
