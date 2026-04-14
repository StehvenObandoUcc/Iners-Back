import { Song } from '../domain/entities/Song';
import { MusicSource } from '../domain/enums/MusicSource';
import { IMusicSource } from '../domain/interfaces/IMusicSource';
import { SongRepository } from '../repositories/SongRepository';
import { PlaybackStateRepository } from '../repositories/PlaybackStateRepository';
import { PlaylistStateDTO } from '../dto/response/PlaylistStateDTO';
import { SongDTO } from '../dto/response/SongDTO';
import { PlayerStateService } from './PlayerStateService';
import { LocalMusicService } from './LocalMusicService';
import { SpotifyService } from './SpotifyService';
import { HttpError } from '../errors/HttpError';
import { RepeatMode } from '../domain/enums/RepeatMode';

export class PlaylistService {
  constructor(
    private readonly state: PlayerStateService,
    private readonly songRepo: SongRepository,
    private readonly localMusicService: LocalMusicService,
    private readonly spotifyService: SpotifyService,
    private readonly playbackStateRepo: PlaybackStateRepository,
  ) {}

  async loadFromDB(): Promise<void> {
    const persisted = await this.playbackStateRepo.load();

    if (persisted && persisted.queueIds.length > 0) {
      // Restore full persisted state
      const allIds = [
        ...new Set([
          ...persisted.queueIds,
          ...persisted.historyIds,
          ...persisted.upNextIds,
        ]),
      ];

      // Fetch all songs in one query
      const songMap = new Map<number, Song>();
      const rows = await this.songRepo.findByIds(allIds);
      for (const s of rows) songMap.set(s.id, s);

      // Rebuild queue
      for (const id of persisted.queueIds) {
        const song = songMap.get(id);
        if (song) this.state.getPlaylist().addLast(song);
      }

      // Set current song
      if (persisted.currentSongId) {
        const cur = songMap.get(persisted.currentSongId);
        if (cur) this.state.getPlaylist().setCurrent(cur);
      }

      // Rebuild history
      for (const id of persisted.historyIds) {
        const song = songMap.get(id);
        if (song) this.state.getHistory().push(song);
      }

      // Rebuild upNext queue
      for (const id of persisted.upNextIds) {
        const song = songMap.get(id);
        if (song) this.state.getUpNext().enqueue(song);
      }

      // Restore repeat + shuffle
      this.state.setRepeatMode(persisted.repeatMode);
      this.state.setShuffle(persisted.shuffle);
    } else {
      // Fallback: load all songs ordered by playlistPosition
      const songs = await this.songRepo.findAllOrderedByPosition();
      for (const song of songs) {
        this.state.getPlaylist().addLast(song);
      }
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
    // Only removes from the active queue — does NOT delete from DB or disk
    const removed = this.state.getPlaylist().removeById(songId);
    if (!removed) {
      throw new HttpError(404, 'La cancion no existe en la playlist activa');
    }
    await this.savePositions();
    return this.buildStateDTO();
  }

  async enqueueUpNext(songId: number): Promise<PlaylistStateDTO> {
    const song = await this.assertSongExists(songId);
    this.state.getUpNext().enqueue(song);
    await this.persistPlaybackState();
    return this.buildStateDTO();
  }

  async replaceUpNext(songIds: number[]): Promise<PlaylistStateDTO> {
    const rows = await this.songRepo.findByIds(songIds);
    const songMap = new Map(rows.map((song) => [song.id, song]));
    const orderedSongs = songIds
      .map((id) => songMap.get(id))
      .filter((song): song is Song => !!song);

    this.state.getUpNext().replace(orderedSongs);
    await this.persistPlaybackState();
    return this.buildStateDTO();
  }

  async next(): Promise<PlaylistStateDTO> {
    const current = this.state.getPlaylist().getCurrent();
    const repeatMode = this.state.getRepeatMode();

    // Push to history only if it's different from the last entry (no duplicates)
    if (current && repeatMode !== RepeatMode.ONE) {
      const lastInHistory = this.state.getHistory().peek();
      if (!lastInHistory || lastInHistory.id !== current.id) {
        this.state.getHistory().push(current);
      }
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
      this.state.getPlaylist().next(repeatMode);
    }

    await this.persistPlaybackState();
    return this.buildStateDTO();
  }

  async setShuffle(enabled: boolean): Promise<PlaylistStateDTO> {
    if (this.state.isShuffle() === enabled) {
      return this.buildStateDTO();
    }

    this.state.setShuffle(enabled);

    if (enabled) {
      this.shuffleQueueFromCurrent();
    } else {
      this.restoreQueueToNormalOrder();
    }

    await this.persistPlaybackState();
    return this.buildStateDTO();
  }

  async previous(): Promise<PlaylistStateDTO> {
    // If history has entries, pop the last song and set it as current
    if (!this.state.getHistory().isEmpty()) {
      const prevSong = this.state.getHistory().pop();
      if (prevSong) {
        const found = this.state.getPlaylist().setCurrent(prevSong);
        if (!found) {
          // Song was in history but not in active queue — add it first
          this.state.getPlaylist().addFirst(prevSong);
          this.state.getPlaylist().setCurrent(prevSong);
          await this.savePositions();
        }
        await this.persistPlaybackState();
        return this.buildStateDTO();
      }
    }
    // No history — just go to previous node in doubly-linked list
    this.state.getPlaylist().previous();
    await this.persistPlaybackState();
    return this.buildStateDTO();
  }

  async getState(): Promise<PlaylistStateDTO> {
    return this.buildStateDTO();
  }

  /**
   * Replaces the current queue with a given list of songs (e.g. from a user playlist).
   * Sets the first song as current.
   */
  async loadUserPlaylist(songs: Song[]): Promise<PlaylistStateDTO> {
    // Clear everything
    this.state.getPlaylist().clear();
    this.state.getUpNext().clear();
    this.state.getHistory().clear();
    this.state.setRepeatMode(RepeatMode.ALL);

    for (const song of songs) {
      this.state.getPlaylist().addLast(song);
    }
    if (songs.length > 0) {
      this.state.getPlaylist().setCurrent(songs[0]);
    }
    await this.savePositions();

    if (this.state.isShuffle()) {
      this.shuffleQueueFromCurrent();
      await this.persistPlaybackState();
    }

    return this.buildStateDTO();
  }

  async loadCollection(songIds: number[], startSongId?: number): Promise<PlaylistStateDTO> {
    if (songIds.length === 0) {
      throw new HttpError(400, 'Debes enviar al menos una cancion');
    }

    const uniqueIds = [...new Set(songIds)];
    const rows = await this.songRepo.findByIds(uniqueIds);
    const songMap = new Map(rows.map((song) => [song.id, song]));
    const orderedSongs = uniqueIds.map((id) => songMap.get(id)).filter((song): song is Song => !!song);

    if (orderedSongs.length === 0) {
      throw new HttpError(404, 'No se encontraron canciones para cargar');
    }

    this.state.getPlaylist().clear();
    this.state.getUpNext().clear();
    this.state.getHistory().clear();
    this.state.setRepeatMode(RepeatMode.ALL);

    for (const song of orderedSongs) {
      this.state.getPlaylist().addLast(song);
    }

    const currentSong = startSongId
      ? orderedSongs.find((song) => song.id === startSongId) ?? orderedSongs[0]
      : orderedSongs[0];
    this.state.getPlaylist().setCurrent(currentSong);

    await this.savePositions();

    if (this.state.isShuffle()) {
      this.shuffleQueueFromCurrent();
      await this.persistPlaybackState();
    }

    return this.buildStateDTO();
  }

  async getCurrentSong(): Promise<SongDTO | null> {
    const current = this.state.getPlaylist().getCurrent();
    if (!current) return null;
    return this.toDTO(current);
  }

  // Agrega la cancion al inicio, la establece como current
  async playNow(songId: number): Promise<PlaylistStateDTO> {
    const song = await this.assertSongExists(songId);

    // Push current to history before changing (anti-duplicate guard)
    const current = this.state.getPlaylist().getCurrent();
    if (current && current.id !== song.id) {
      const lastInHistory = this.state.getHistory().peek();
      if (!lastInHistory || lastInHistory.id !== current.id) {
        this.state.getHistory().push(current);
      }
    }

    // If song is already in queue, just set it as current
    const found = this.state.getPlaylist().setCurrent(song);
    if (!found) {
      this.state.getPlaylist().addFirst(song);
      this.state.getPlaylist().setCurrent(song);
      await this.savePositions();
    }
    await this.persistPlaybackState();
    return this.buildStateDTO();
  }

  async pruneDeletedSong(songId: number): Promise<void> {
    this.state.getPlaylist().removeById(songId);
    this.state.getUpNext().removeById(songId);
    this.state.getHistory().removeById(songId);
    await this.savePositions();
  }

  private async savePositions(): Promise<void> {
    const positions = this.state
      .getPlaylist()
      .toArray()
      .map((song, index) => ({ id: song.id, position: index }));

    await this.songRepo.updatePositions(positions);
    await this.persistPlaybackState();
  }

  /** Persists the full player state so it survives server restarts. */
  private async persistPlaybackState(): Promise<void> {
    const current = this.state.getPlaylist().getCurrent();
    await this.playbackStateRepo.save({
      currentSongId: current?.id ?? null,
      queueIds:   this.state.getPlaylist().toArray().map((s) => s.id),
      historyIds: this.state.getHistory().toArray().map((s) => s.id),
      upNextIds:  this.state.getUpNext().toArray().map((s) => s.id),
      repeatMode: this.state.getRepeatMode(),
      shuffle:    this.state.isShuffle(),
    });
  }

  private async toDTO(song: Song): Promise<SongDTO> {
    const streamUrl =
      song.source === MusicSource.LOCAL
        ? `/api/player/stream/${song.id}`
        : (song.filePathOrUri ?? '');
    const normalized = this.normalizeDisplayMetadata(song);

    return {
      id:              song.id,
      title:           normalized.title,
      artist:          normalized.artist,
      album:           song.album,
      year:            song.year,
      genre:           song.genre,
      bpm:             song.bpm,
      trackNumber:     song.trackNumber,
      discNumber:      song.discNumber,
      composer:        song.composer,
      durationSeconds: song.durationSeconds,
      bitrate:         song.bitrate,
      sampleRate:      song.sampleRate,
      replayGainTrack: song.replayGainTrack,
      replayGainAlbum: song.replayGainAlbum,
      source:          song.source,
      coverImageUrl:   song.coverImageUrl,
      streamUrl,
      spotifyUri:      song.source === MusicSource.SPOTIFY ? (song.filePathOrUri ?? null) : null,
      isFavorite:      song.isFavorite,
      hasLyrics:       song.hasLyrics,
      artistId:        song.artistId,
      albumId:         song.albumId,
    };
  }

  private normalizeDisplayMetadata(song: Song): { title: string; artist: string | null } {
    const title = song.title?.trim() ?? '';
    const artist = song.artist?.trim() || null;

    if (artist || !title.includes(' - ')) {
      return { title, artist };
    }

    const [rawArtist, ...rawTitleParts] = title.split(' - ');
    const inferredArtist = rawArtist.trim();
    const inferredTitle = rawTitleParts.join(' - ').trim();

    if (!inferredArtist || !inferredTitle) {
      return { title, artist };
    }

    return {
      title: inferredTitle,
      artist: inferredArtist,
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
      shuffle: this.state.isShuffle(),
    };
  }

  private shuffleQueueFromCurrent(): void {
    const current = this.state.getPlaylist().getCurrent();
    const queue = this.state.getPlaylist().toArray();

    if (queue.length <= 1) {
      return;
    }

    const upcoming = current
      ? queue.filter((song) => song.id !== current.id)
      : [...queue];

    this.shuffleSongs(upcoming);

    const reordered = current ? [current, ...upcoming] : upcoming;
    this.replaceActiveQueue(reordered, current ?? reordered[0] ?? null);
  }

  private restoreQueueToNormalOrder(): void {
    const current = this.state.getPlaylist().getCurrent();
    const reordered = [...this.state.getPlaylist().toArray()]
      .sort((left, right) => left.playlistPosition - right.playlistPosition);

    this.replaceActiveQueue(reordered, current);
  }

  private replaceActiveQueue(songs: Song[], current: Song | null): void {
    const playlist = this.state.getPlaylist();
    playlist.clear();

    for (const song of songs) {
      playlist.addLast(song);
    }

    if (current) {
      playlist.setCurrent(current);
    }
  }

  private shuffleSongs(songs: Song[]): void {
    for (let index = songs.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [songs[index], songs[randomIndex]] = [songs[randomIndex], songs[index]];
    }
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
