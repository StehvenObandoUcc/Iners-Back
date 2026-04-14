import { CreateSongRequest } from '../dto/request/CreateSongRequest';
import { Song } from '../domain/entities/Song';
import { MusicSource } from '../domain/enums/MusicSource';
import { HttpError } from '../errors/HttpError';
import { SongRepository } from '../repositories/SongRepository';
import { ArtistRepository } from '../repositories/ArtistRepository';
import { AlbumRepository } from '../repositories/AlbumRepository';
import { LyricsRepository } from '../repositories/LyricsRepository';
import { UserPlaylistRepository } from '../repositories/UserPlaylistRepository';
import { ExtractedMetadata, MetadataExtractorService } from './MetadataExtractorService';
import { PlaylistService } from './PlaylistService';
import { readdir } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const AUDIO_EXTS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus']);

export class SongCatalogService {
  constructor(
    private readonly songRepo: SongRepository,
    private readonly artistRepo?: ArtistRepository,
    private readonly albumRepo?: AlbumRepository,
    private readonly lyricsRepo?: LyricsRepository,
    private readonly metadataExtractor?: MetadataExtractorService,
    private readonly playlistService?: PlaylistService,
    private readonly userPlaylistRepo?: UserPlaylistRepository,
  ) {}

  async listAll(): Promise<Song[]> {
    return this.songRepo.findAllOrderedByPosition();
  }

  async createSong(payload: CreateSongRequest): Promise<Song> {
    const title = payload.title?.trim();
    if (!title) {
      throw new HttpError(400, 'El titulo es obligatorio');
    }

    const source = payload.source ?? MusicSource.LOCAL;
    const playlistPosition = payload.playlistPosition ?? 0;

    if (source === MusicSource.SPOTIFY && !payload.spotifyTrackId && !payload.filePathOrUri) {
      throw new HttpError(400, 'Para SPOTIFY debes enviar spotifyTrackId o filePathOrUri');
    }

    if (source === MusicSource.LOCAL && !payload.filePathOrUri) {
      throw new HttpError(400, 'Para LOCAL debes enviar filePathOrUri');
    }

    if (payload.filePathOrUri) {
      const existingByPath = await this.songRepo.findByFilePathOrUri(payload.filePathOrUri);
      if (existingByPath) {
        throw new HttpError(409, 'Ya existe una cancion registrada con ese filePathOrUri');
      }
    }

    if (payload.spotifyTrackId) {
      const existingBySpotifyId = await this.songRepo.findBySpotifyTrackId(payload.spotifyTrackId);
      if (existingBySpotifyId) {
        throw new HttpError(409, 'Ya existe una cancion registrada con ese spotifyTrackId');
      }
    }

    const songToSave: Partial<Song> = {
      title,
      artist: payload.artist ?? null,
      album: payload.album ?? null,
      year: payload.year ?? null,
      genre: payload.genre ?? null,
      bpm: payload.bpm ?? null,
      trackNumber: payload.trackNumber ?? null,
      discNumber: payload.discNumber ?? null,
      composer: payload.composer ?? null,
      comment: payload.comment ?? null,
      replayGainTrack: payload.replayGainTrack ?? null,
      replayGainAlbum: payload.replayGainAlbum ?? null,
      bitrate: payload.bitrate ?? null,
      sampleRate: payload.sampleRate ?? null,
      durationSeconds: payload.durationSeconds ?? null,
      source,
      filePathOrUri: payload.filePathOrUri ?? null,
      spotifyTrackId: payload.spotifyTrackId ?? null,
      coverImageUrl: payload.coverImageUrl ?? null,
      playlistPosition,
      isFavorite: false,
      hash: payload.hash ?? null,
      hasLyrics: !!(payload.lyricsLrc || payload.lyricsPlain),
    };

    // ── Link to Artist / Album entities if present ──────────────────────────
    if (payload.artist && this.artistRepo) {
      const artistEntity = await this.artistRepo.findOrCreate(payload.artist);
      songToSave.artistId = artistEntity.id;
      if (payload.coverImageUrl && !artistEntity.imageUrl) {
        await this.artistRepo.updateImage(artistEntity.id, payload.coverImageUrl);
      }

      if (payload.album && this.albumRepo) {
        const albumEntity = await this.albumRepo.findOrCreate(
          payload.album,
          artistEntity.id,
          payload.year ?? null,
          payload.coverImageUrl ?? null,
        );
        songToSave.albumId = albumEntity.id;
      }
    } else if (payload.album && this.albumRepo) {
      // Album without artist
      const albumEntity = await this.albumRepo.findOrCreate(
        payload.album,
        null,
        payload.year ?? null,
        payload.coverImageUrl ?? null,
      );
      songToSave.albumId = albumEntity.id;
    }

    return this.songRepo.save(songToSave);
  }

  /** Persist lyrics row (and update song.hasLyrics flag) after song creation/update */
  async saveLyrics(
    songId: number,
    lrc: string | null,
    plain: string | null,
  ): Promise<void> {
    if (!this.lyricsRepo) return;
    const hasContent = !!(lrc || plain);
    await this.lyricsRepo.save(songId, lrc, plain);
    await this.songRepo.setHasLyrics(songId, hasContent);
  }

  async seedLocalSongs(baseDir: string): Promise<Song[]> {
    const fileNames = await readdir(baseDir);
    const audioFiles = fileNames
      .filter((f) => AUDIO_EXTS.has(path.extname(f).toLowerCase()))
      .sort();

    if (audioFiles.length === 0) {
      throw new HttpError(400, `No se encontraron archivos de audio en ${baseDir}`);
    }

    const extractor = this.metadataExtractor ?? new MetadataExtractorService();
    const coversDir = path.resolve(process.cwd(), 'music', 'covers');

    const saved: Song[] = [];
    for (const fileName of audioFiles) {
      const filePath = path.resolve(baseDir, fileName);
      const ext = path.extname(fileName).toLowerCase();
      const titleFallback = path.basename(fileName, ext).replace(/[-_]+/g, ' ').trim() || 'Cancion local';
      const meta = await extractor.extractFromFile(filePath);

      // Deduplication by SHA-256
      let hash: string | null = null;
      try {
        const buf = fs.readFileSync(filePath);
        hash = crypto.createHash('sha256').update(buf).digest('hex');
        const existing = await this.songRepo.findByHash(hash);
        if (existing) {
          const updatedExisting = await this.backfillExistingSong(existing, meta, hash);
          saved.push(updatedExisting);
          continue;
        }
      } catch { /* ignore — hash is optional */ }

      const title = meta.title || titleFallback;

      const coverImageUrl = this.persistCoverImage(meta.coverData, hash, coversDir);

      const relativePath = `${baseDir.replace(/\\/g, '/')}/${fileName}`;

      // Skip if already registered by path
      const existingByPath = await this.songRepo.findByFilePathOrUri(relativePath);
      if (existingByPath) {
        const updatedExisting = await this.backfillExistingSong(existingByPath, meta, hash, coverImageUrl);
        saved.push(updatedExisting);
        continue;
      }

      const item: CreateSongRequest = {
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
        filePathOrUri:   relativePath,
        coverImageUrl,
        hash,
        lyricsLrc:       meta.lyricsLrc,
        lyricsPlain:     meta.lyricsPlain,
      };

      const song = await this.createSong(item);

      // Save lyrics separately
      if (meta.lyricsLrc || meta.lyricsPlain) {
        await this.saveLyrics(song.id, meta.lyricsLrc, meta.lyricsPlain);
      }

      saved.push(song);
    }
    return saved;
  }

  private persistCoverImage(
    coverData: { data: Buffer; format: string } | null,
    hash: string | null,
    coversDir: string = path.resolve(process.cwd(), 'music', 'covers'),
  ): string | null {
    if (!coverData) {
      return null;
    }

    if (!fs.existsSync(coversDir)) {
      fs.mkdirSync(coversDir, { recursive: true });
    }

    const coverExt = coverData.format.split('/')[1] ?? 'jpg';
    const coverHash = hash?.substring(0, 16) ?? Math.random().toString(36).slice(2);
    const coverName = `${coverHash}.${coverExt}`;
    const coverPath = path.join(coversDir, coverName);

    if (!fs.existsSync(coverPath)) {
      fs.writeFileSync(coverPath, coverData.data);
    }

    return `http://localhost:3000/covers/${coverName}`;
  }

  private async backfillExistingSong(
    song: Song,
    meta: ExtractedMetadata,
    hash: string | null,
    coverImageUrl?: string | null,
  ): Promise<Song> {
    const resolvedCover = coverImageUrl ?? this.persistCoverImage(meta.coverData, hash);
    if (song.coverImageUrl || !resolvedCover) {
      return song;
    }

    const updated = await this.songRepo.updateMetadata(song.id, { coverImageUrl: resolvedCover });
    return updated ?? song;
  }

  async findById(id: number): Promise<Song | null> {
    return this.songRepo.findById(id);
  }

  async findByFilePathOrUri(filePathOrUri: string): Promise<Song | null> {
    return this.songRepo.findByFilePathOrUri(filePathOrUri);
  }

  async findByHash(hash: string): Promise<Song | null> {
    return this.songRepo.findByHash(hash);
  }

  async ensureSpotifySong(song: Song): Promise<Song> {
    const spotifyTrackId = song.spotifyTrackId?.trim();
    if (!spotifyTrackId) {
      throw new HttpError(400, 'La cancion de Spotify no tiene spotifyTrackId');
    }

    const existing = await this.songRepo.findBySpotifyTrackId(spotifyTrackId);
    if (existing) {
      const patch: Partial<Song> = {};

      if (existing.title !== song.title) patch.title = song.title;
      if (existing.artist !== song.artist) patch.artist = song.artist;
      if (existing.album !== song.album) patch.album = song.album;
      if (existing.durationSeconds !== song.durationSeconds) patch.durationSeconds = song.durationSeconds;
      if (existing.coverImageUrl !== song.coverImageUrl) patch.coverImageUrl = song.coverImageUrl;
      if (existing.filePathOrUri !== song.filePathOrUri) patch.filePathOrUri = song.filePathOrUri;

      if (Object.keys(patch).length === 0) {
        return existing;
      }

      return (await this.songRepo.updateMetadata(existing.id, patch)) ?? existing;
    }

    return this.createSong({
      title: song.title,
      artist: song.artist,
      album: song.album,
      durationSeconds: song.durationSeconds,
      source: MusicSource.SPOTIFY,
      filePathOrUri: song.filePathOrUri,
      spotifyTrackId,
      coverImageUrl: song.coverImageUrl,
    });
  }

  async toggleFavorite(id: number): Promise<Song | null> {
    const song = await this.songRepo.toggleFavorite(id);
    if (!song) return null;

    if (!song.isFavorite) {
      const deleted = await this.deleteIfOrphaned(id);
      if (deleted) {
        return null;
      }
    }

    return song;
  }

  async findFavorites(): Promise<Song[]> {
    return this.songRepo.findFavorites();
  }

  async updateSong(id: number, patch: Partial<Song>): Promise<Song | null> {
    return this.songRepo.updateMetadata(id, patch);
  }

  async deleteById(id: number): Promise<void> {
    await this.songRepo.deleteById(id);
  }

  async deleteFullyById(id: number): Promise<void> {
    const song = await this.songRepo.findById(id);
    if (!song) return;

    if (this.playlistService) {
      await this.playlistService.pruneDeletedSong(id);
    }

    if (song.source === MusicSource.LOCAL && song.filePathOrUri) {
      const fullPath = path.isAbsolute(song.filePathOrUri)
        ? song.filePathOrUri
        : path.resolve(process.cwd(), song.filePathOrUri);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    await this.songRepo.deleteById(id);

    if (song.albumId && this.albumRepo) {
      const albumSongCount = await this.songRepo.countByAlbumId(song.albumId);
      if (albumSongCount === 0) {
        await this.albumRepo.delete(song.albumId);
      }
    }

    if (song.artistId && this.artistRepo) {
      const artistSongCount = await this.songRepo.countByArtistId(song.artistId);
      if (artistSongCount === 0) {
        await this.artistRepo.delete(song.artistId);
      }
    }
  }

  async deleteIfOrphaned(id: number): Promise<boolean> {
    const song = await this.songRepo.findById(id);
    if (!song) {
      return false;
    }

    const isReferencedByPlaylist = this.userPlaylistRepo
      ? await this.userPlaylistRepo.isSongReferenced(id)
      : false;

    if (song.isFavorite || isReferencedByPlaylist) {
      return false;
    }

    await this.deleteFullyById(id);
    return true;
  }
}
