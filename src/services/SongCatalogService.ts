import { CreateSongRequest } from '../dto/request/CreateSongRequest';
import { Song } from '../domain/entities/Song';
import { MusicSource } from '../domain/enums/MusicSource';
import { HttpError } from '../errors/HttpError';
import { SongRepository } from '../repositories/SongRepository';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

export class SongCatalogService {
  constructor(private readonly songRepo: SongRepository) {}

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
      durationSeconds: payload.durationSeconds ?? null,
      source,
      filePathOrUri: payload.filePathOrUri ?? null,
      spotifyTrackId: payload.spotifyTrackId ?? null,
      coverImageUrl: payload.coverImageUrl ?? null,
      playlistPosition,
    };

    return this.songRepo.save(songToSave);
  }

  async seedLocalSongs(baseDir: string): Promise<Song[]> {
    const fileNames = await readdir(baseDir);
    const mp3Files = fileNames.filter((fileName) => fileName.toLowerCase().endsWith('.mp3')).sort();

    if (mp3Files.length === 0) {
      throw new HttpError(400, `No se encontraron archivos mp3 en ${baseDir}`);
    }

    const saved: Song[] = [];
    for (const fileName of mp3Files) {
      const titleFromFile = fileName.replace(/\.mp3$/i, '').replace(/[-_]+/g, ' ').trim();

      const item: CreateSongRequest = {
        title: titleFromFile.length > 0 ? titleFromFile : 'Cancion local',
        artist: 'Local Artist',
        album: 'Local Library',
        durationSeconds: null,
        source: MusicSource.LOCAL,
        filePathOrUri: path.posix.join(baseDir.replace(/\\/g, '/'), fileName),
      };

      const song = await this.createSong(item);
      saved.push(song);
    }
    return saved;
  }

  async findById(id: number): Promise<Song | null> {
    return this.songRepo.findById(id);
  }

  async findByFilePathOrUri(filePathOrUri: string): Promise<Song | null> {
    return this.songRepo.findByFilePathOrUri(filePathOrUri);
  }

  async deleteById(id: number): Promise<void> {
    await this.songRepo.deleteById(id);
  }
}
