import { Request, Response } from 'express';
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
    this.playerStateService.setPlaying(true);
    const response: ApiResponse<{ isPlaying: boolean }> = {
      success: true,
      data: { isPlaying: true },
      error: null,
    };
    res.status(200).json(response);
  }

  async pause(_req: Request, res: Response): Promise<void> {
    this.playerStateService.setPlaying(false);
    const response: ApiResponse<{ isPlaying: boolean }> = {
      success: true,
      data: { isPlaying: false },
      error: null,
    };
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
    if (!song) {
      throw new HttpError(404, 'Cancion no encontrada');
    }

    if (!song.filePathOrUri) {
      throw new HttpError(400, 'La cancion no tiene ruta local para streaming');
    }

    const absolutePath = path.isAbsolute(song.filePathOrUri)
      ? song.filePathOrUri
      : path.resolve(process.cwd(), song.filePathOrUri);

    const stream = this.localMusicService.getAudioResource(absolutePath);
    stream.once('error', () => {
      if (!res.headersSent) {
        res.status(404).json({
          success: false,
          data: null,
          error: 'Archivo de audio no encontrado en disco',
        } satisfies ApiResponse<never>);
      }
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    stream.pipe(res);
  }
}
