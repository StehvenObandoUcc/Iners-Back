import { Song } from '../domain/entities/Song';
import { MusicSource } from '../domain/enums/MusicSource';
import { IMusicSource } from '../domain/interfaces/IMusicSource';
import { SongRepository } from '../repositories/SongRepository';
import { PlaylistStateDTO } from '../dto/response/PlaylistStateDTO';
import { SongDTO } from '../dto/response/SongDTO';
import { PlayerStateService } from './PlayerStateService';
import { LocalMusicService } from './LocalMusicService';
import { SpotifyService } from './SpotifyService';
import { HttpError } from '../errors/HttpError';

export class PlaylistService {
  constructor(
    private readonly state: PlayerStateService,
    private readonly songRepo: SongRepository,
    private readonly localMusicService: LocalMusicService,
    private readonly spotifyService: SpotifyService,
  ) {}

  async loadFromDB(): Promise<void> {
    const songs = await this.songRepo.findAllOrderedByPosition();
    for (const song of songs) {
      this.state.getPlaylist().addLast(song);
    }
  }

  async addSongFirst(songId: number): Promise<PlaylistStateDTO> {
    const song = await this.assertSongExists(songId);
    this.state.getPlaylist().addFirst(song);
    await this.savePositions();
    return this.buildStateDTO();
  }

  async addSongLast(songId: number): Promise<PlaylistStateDTO> {
    const song = await this.assertSongExists(songId);
    this.state.getPlaylist().addLast(song);
    await this.savePositions();
    return this.buildStateDTO();
  }

  async addSongAt(position: number, songId: number): Promise<PlaylistStateDTO> {
    const playlist = this.state.getPlaylist();
    if (position < 0 || position > playlist.size) {
      throw new HttpError(400, 'Posicion invalida');
    }

    const song = await this.assertSongExists(songId);
    playlist.addAt(position, song);
    await this.savePositions();
    return this.buildStateDTO();
  }

  async removeSong(songId: number): Promise<PlaylistStateDTO> {
    const removedFromPlaylist = this.state.getPlaylist().removeById(songId);
    if (!removedFromPlaylist) {
      throw new HttpError(404, 'La cancion no existe en la playlist');
    }

    await this.songRepo.deleteById(songId);
    await this.savePositions();
    return this.buildStateDTO();
  }

  async enqueueUpNext(songId: number): Promise<PlaylistStateDTO> {
    const song = await this.assertSongExists(songId);
    this.state.getUpNext().enqueue(song);
    return this.buildStateDTO();
  }

  async next(): Promise<PlaylistStateDTO> {
    const current = this.state.getPlaylist().getCurrent();
    if (current) {
      this.state.getHistory().push(current);
    }

    if (!this.state.getUpNext().isEmpty()) {
      const queuedSong = this.state.getUpNext().dequeue();
      if (queuedSong) {
        const setCurrentResult = this.state.getPlaylist().setCurrent(queuedSong);
        if (!setCurrentResult) {
          this.state.getPlaylist().addLast(queuedSong);
          this.state.getPlaylist().setCurrent(queuedSong);
          await this.savePositions();
        }
      }
    } else {
      this.state.getPlaylist().next(this.state.getRepeatMode());
    }

    this.state.setPlaying(true);
    return this.buildStateDTO();
  }

  async previous(): Promise<PlaylistStateDTO> {
    this.state.getPlaylist().previous();
    return this.buildStateDTO();
  }

  async getState(): Promise<PlaylistStateDTO> {
    return this.buildStateDTO();
  }

  async getCurrentSong(): Promise<SongDTO | null> {
    const current = this.state.getPlaylist().getCurrent();
    if (!current) return null;
    return this.toDTO(current);
  }

  // Agrega la cancion al inicio, la establece como current y empieza a reproducir
  async playNow(songId: number): Promise<PlaylistStateDTO> {
    const song = await this.assertSongExists(songId);
    this.state.getPlaylist().addFirst(song);
    this.state.getPlaylist().setCurrent(song);
    this.state.setPlaying(true);
    await this.savePositions();
    return this.buildStateDTO();
  }

  private async savePositions(): Promise<void> {
    const positions = this.state
      .getPlaylist()
      .toArray()
      .map((song, index) => ({ id: song.id, position: index }));

    await this.songRepo.updatePositions(positions);
  }

  private async toDTO(song: Song): Promise<SongDTO> {
    const sourceService = this.resolveSource(song.source);
    const streamUrl =
      song.source === MusicSource.LOCAL
        ? `/api/player/stream/${song.id}`
        : await sourceService.getStreamUrl(song.filePathOrUri ?? '');

    return {
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      durationSeconds: song.durationSeconds,
      source: song.source,
      coverImageUrl: song.coverImageUrl,
      streamUrl,
    };
  }

  private async buildStateDTO(): Promise<PlaylistStateDTO> {
    const current = this.state.getPlaylist().getCurrent();
    const playlistSongs = this.state.getPlaylist().toArray();
    const upNextSongs = this.state.getUpNext().toArray();
    const historySongs = this.state.getHistory().toArray();

    const playlist = await Promise.all(playlistSongs.map((song) => this.toDTO(song)));
    const upNext = await Promise.all(upNextSongs.map((song) => this.toDTO(song)));
    const history = await Promise.all(historySongs.map((song) => this.toDTO(song)));

    return {
      currentSong: current ? await this.toDTO(current) : null,
      playlist,
      upNext,
      history,
      repeatMode: this.state.getRepeatMode(),
      isPlaying: this.state.isPlaying(),
    };
  }

  private resolveSource(source: MusicSource): IMusicSource {
    const sources: Record<MusicSource, IMusicSource> = {
      [MusicSource.LOCAL]: this.localMusicService,
      [MusicSource.SPOTIFY]: this.spotifyService,
    };
    const implementation = sources[source];
    if (!implementation) {
      throw new HttpError(400, `Fuente de musica no soportada: ${source}`);
    }
    return implementation;
  }

  private async assertSongExists(songId: number): Promise<Song> {
    const song = await this.songRepo.findById(songId);
    if (!song) {
      throw new HttpError(404, 'Cancion no encontrada');
    }
    return song;
  }
}
