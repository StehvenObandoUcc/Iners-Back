import { Request, Response } from 'express';
import { AddSongRequest } from '../dto/request/AddSongRequest';
import { ApiResponse } from '../dto/response/ApiResponse';
import { PlaylistStateDTO } from '../dto/response/PlaylistStateDTO';
import { PlaylistService } from '../services/PlaylistService';

export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  async getPlaylist(_req: Request, res: Response): Promise<void> {
    const state = await this.playlistService.getState();
    const response: ApiResponse<PlaylistStateDTO> = { success: true, data: state, error: null };
    res.status(200).json(response);
  }

  async addSongFirst(req: Request, res: Response): Promise<void> {
    const { songId } = req.body as AddSongRequest;
    const state = await this.playlistService.addSongFirst(Number(songId));
    const response: ApiResponse<PlaylistStateDTO> = { success: true, data: state, error: null };
    res.status(200).json(response);
  }

  async addSongLast(req: Request, res: Response): Promise<void> {
    const { songId } = req.body as AddSongRequest;
    const state = await this.playlistService.addSongLast(Number(songId));
    const response: ApiResponse<PlaylistStateDTO> = { success: true, data: state, error: null };
    res.status(200).json(response);
  }

  async addSongAt(req: Request, res: Response): Promise<void> {
    const position = Number(req.params.position);
    const { songId } = req.body as AddSongRequest;
    const state = await this.playlistService.addSongAt(position, Number(songId));
    const response: ApiResponse<PlaylistStateDTO> = { success: true, data: state, error: null };
    res.status(200).json(response);
  }

  async removeSong(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const state = await this.playlistService.removeSong(id);
    const response: ApiResponse<PlaylistStateDTO> = { success: true, data: state, error: null };
    res.status(200).json(response);
  }

  async enqueueUpNext(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const state = await this.playlistService.enqueueUpNext(id);
    const response: ApiResponse<PlaylistStateDTO> = { success: true, data: state, error: null };
    res.status(200).json(response);
  }

  async replaceUpNext(req: Request, res: Response): Promise<void> {
    const { songIds } = req.body as { songIds?: number[] };
    const state = await this.playlistService.replaceUpNext(
      Array.isArray(songIds) ? songIds.map(Number) : [],
    );
    const response: ApiResponse<PlaylistStateDTO> = { success: true, data: state, error: null };
    res.status(200).json(response);
  }

  async loadCollection(req: Request, res: Response): Promise<void> {
    const { songIds, startSongId } = req.body as { songIds?: number[]; startSongId?: number };
    const state = await this.playlistService.loadCollection(
      Array.isArray(songIds) ? songIds.map(Number) : [],
      startSongId !== undefined ? Number(startSongId) : undefined,
    );
    const response: ApiResponse<PlaylistStateDTO> = { success: true, data: state, error: null };
    res.status(200).json(response);
  }
}
