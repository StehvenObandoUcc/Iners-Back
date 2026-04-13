import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CreateSongRequest } from '../dto/request/CreateSongRequest';
import { ApiResponse } from '../dto/response/ApiResponse';
import { Song } from '../domain/entities/Song';
import { Lyrics } from '../domain/entities/Lyrics';
import { MusicSource } from '../domain/enums/MusicSource';
import { HttpError } from '../errors/HttpError';
import { LocalMusicService } from '../services/LocalMusicService';
import { SongCatalogService } from '../services/SongCatalogService';
import { SpotifyService } from '../services/SpotifyService';
import { MetadataExtractorService } from '../services/MetadataExtractorService';
import { LyricsRepository } from '../repositories/LyricsRepository';

export class SongController {
  constructor(
    private readonly songCatalogService: SongCatalogService,
    private readonly localMusicService: LocalMusicService,
    private readonly spotifyService: SpotifyService,
    private readonly metadataExtractor: MetadataExtractorService,
    private readonly lyricsRepo: LyricsRepository,
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
    if (payload.lyricsLrc || payload.lyricsPlain) {
      await this.songCatalogService.saveLyrics(song.id, payload.lyricsLrc ?? null, payload.lyricsPlain ?? null);
    }
    const response: ApiResponse<Song> = {
      success: true,
      data: song,
      error: null,
    };
    res.status(201).json(response);
  }

  async uploadMusic(req: Request, res: Response): Promise<void> {
    if (!req.file) throw new HttpError(400, 'No se encontro archivo de audio');

    // ── Deduplication by SHA-256 hash ───────────────────────────────────────
    const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const existingByHash = await this.songCatalogService.findByHash(hash);
    if (existingByHash) {
      res.status(200).json({ success: true, data: existingByHash, error: null } satisfies ApiResponse<Song>);
      return;
    }

    // ── Extract ALL metadata ────────────────────────────────────────────────
    const meta = await this.metadataExtractor.extractFromBuffer(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
    );

    const titleFallback = path.parse(req.file.originalname).name;
    const title = meta.title || titleFallback;

    // ── Save cover art ───────────────────────────────────────────────────────
    let coverImageUrl: string | null = null;
    if (meta.coverData) {
      const coversDir = path.resolve(process.cwd(), 'music', 'covers');
      if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
      const coverExt = meta.coverData.format.split('/')[1] ?? 'jpg';
      const coverName = `${hash.substring(0, 16)}.${coverExt}`;
      const coverPath = path.join(coversDir, coverName);
      fs.writeFileSync(coverPath, meta.coverData.data);
      coverImageUrl = `http://localhost:3000/covers/${coverName}`;
    }

    // ── Save audio file ──────────────────────────────────────────────────────
    const musicDir = path.resolve(process.cwd(), 'music');
    if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const safeName = title
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 80);
    const fileName = `${safeName}-${hash.substring(0, 8)}${ext}`;
    const filePath = path.join(musicDir, fileName);
    fs.writeFileSync(filePath, req.file.buffer);

    // ── Create song in DB ────────────────────────────────────────────────────
    const song = await this.songCatalogService.createSong({
      title,
      artist:          meta.artist,
      album:           meta.album,
      year:            meta.year,
      genre:           meta.genre,
      bpm:             meta.bpm,
      trackNumber:     meta.trackNumber,
      discNumber:      meta.discNumber,
      composer:        meta.composer,
      comment:         meta.comment,
      replayGainTrack: meta.replayGainTrack,
      replayGainAlbum: meta.replayGainAlbum,
      bitrate:         meta.bitrate,
      sampleRate:      meta.sampleRate,
      durationSeconds: meta.durationSeconds,
      source:          MusicSource.LOCAL,
      filePathOrUri:   `music/${fileName}`,
      spotifyTrackId:  null,
      coverImageUrl,
      hash,
      lyricsLrc:   meta.lyricsLrc,
      lyricsPlain: meta.lyricsPlain,
    });

    // ── Save lyrics ──────────────────────────────────────────────────────────
    if (meta.lyricsLrc || meta.lyricsPlain) {
      await this.songCatalogService.saveLyrics(song.id, meta.lyricsLrc, meta.lyricsPlain);
    }

    res.status(201).json({ success: true, data: song, error: null } satisfies ApiResponse<Song>);
  }

  async getLyrics(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const lyrics = await this.lyricsRepo.findBySongId(id);
    if (!lyrics) {
      res.status(200).json({ success: true, data: null, error: null } satisfies ApiResponse<Lyrics | null>);
      return;
    }
    res.status(200).json({ success: true, data: lyrics, error: null } satisfies ApiResponse<Lyrics>);
  }

  async updateSong(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const song = await this.songCatalogService.findById(id);
    if (!song) throw new HttpError(404, 'Cancion no encontrada');

    const {
      title, artist, album, year, genre, bpm, trackNumber, discNumber,
      composer, comment, replayGainTrack, replayGainAlbum, coverImageUrl,
      lyricsLrc, lyricsPlain,
    } = req.body as Partial<CreateSongRequest>;

    const patch: Partial<Song> = {};
    if (title    !== undefined) patch.title    = title ?? song.title;
    if (artist   !== undefined) patch.artist   = artist ?? null;
    if (album    !== undefined) patch.album    = album ?? null;
    if (year     !== undefined) patch.year     = year ?? null;
    if (genre    !== undefined) patch.genre    = genre ?? null;
    if (bpm      !== undefined) patch.bpm      = bpm ?? null;
    if (trackNumber  !== undefined) patch.trackNumber  = trackNumber ?? null;
    if (discNumber   !== undefined) patch.discNumber   = discNumber ?? null;
    if (composer     !== undefined) patch.composer     = composer ?? null;
    if (comment      !== undefined) patch.comment      = comment ?? null;
    if (replayGainTrack !== undefined) patch.replayGainTrack = replayGainTrack ?? null;
    if (replayGainAlbum !== undefined) patch.replayGainAlbum = replayGainAlbum ?? null;
    if (coverImageUrl   !== undefined) patch.coverImageUrl   = coverImageUrl ?? null;

    const updated = await this.songCatalogService.updateSong(id, patch);

    // Update lyrics if provided
    if (lyricsLrc !== undefined || lyricsPlain !== undefined) {
      await this.songCatalogService.saveLyrics(id, lyricsLrc ?? null, lyricsPlain ?? null);
    }

    res.status(200).json({ success: true, data: updated, error: null } satisfies ApiResponse<Song | null>);
  }

  async deleteSong(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const song = await this.songCatalogService.findById(id);
    if (!song) {
      throw new HttpError(404, 'Cancion no encontrada');
    }

    await this.songCatalogService.deleteFullyById(id);

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

    const limit = Math.min(Number(req.query.limit ?? 20), 100);
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
    if (!query) throw new HttpError(400, 'Parametro q es obligatorio');
    if (!this.spotifyService.isAuthenticated()) throw new HttpError(401, 'Spotify no autenticado');

    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const songs = await this.spotifyService.search(query, limit, offset);
    res.status(200).json({ success: true, data: songs, error: null } satisfies ApiResponse<Song[]>);
  }

  async toggleFavorite(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const song = await this.songCatalogService.toggleFavorite(id);
    if (!song) throw new HttpError(404, 'Cancion no encontrada');
    res.status(200).json({ success: true, data: song, error: null } satisfies ApiResponse<Song>);
  }

  async listFavorites(_req: Request, res: Response): Promise<void> {
    const songs = await this.songCatalogService.findFavorites();
    res.status(200).json({ success: true, data: songs, error: null } satisfies ApiResponse<Song[]>);
  }
}

