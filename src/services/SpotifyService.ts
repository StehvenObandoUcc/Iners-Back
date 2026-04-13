import { SpotifyApi, Track } from '@spotify/web-api-ts-sdk';
import { IMusicSource } from '../domain/interfaces/IMusicSource';
import { Song } from '../domain/entities/Song';
import { MusicSource } from '../domain/enums/MusicSource';

export class SpotifyService implements IMusicSource {
  private sdk: SpotifyApi | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private clientId: string = process.env.SPOTIFY_CLIENT_ID ?? '';

  setTokens(accessToken: string, tokenType: string, expiresIn: number, refreshToken: string): void {
    this.sdk = SpotifyApi.withAccessToken(this.clientId, {
      access_token: accessToken,
      token_type: tokenType,
      expires_in: expiresIn,
      refresh_token: refreshToken,
    });
    this.refreshToken = refreshToken;
    // Token expires in `expiresIn` seconds from now
    this.tokenExpiresAt = Date.now() + expiresIn * 1000;
    console.log(`[Spotify] Token set, expires in ${expiresIn}s at ${new Date(this.tokenExpiresAt).toISOString()}`);
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return false;
    // Consider token expired if less than 5 minutes left
    const expired = Date.now() >= this.tokenExpiresAt - 5 * 60 * 1000;
    if (expired) {
      console.warn('[Spotify] Token expired or about to expire');
    }
    return expired;
  }

  async search(query: string, limit: number = 20, offset: number = 0): Promise<Song[]> {
    if (!this.sdk) {
      console.error('[Spotify] SDK not initialized - not authenticated');
      throw new Error('Spotify no autenticado');
    }

    try {
      console.log(`[Spotify] Searching: "${query}" (limit=${limit}, offset=${offset})`);
      // Spotify SDK search: search(query, types, options?, limit?, offset?)
      // Note: limit and offset are passed directly but may have limitations
      const maxLimit = Math.min(limit, 50);
      const result = await this.sdk.search(query, ['track']);
      
      // Apply limit and offset manually from results
      const allTracks = result.tracks.items;
      const paginatedTracks = allTracks.slice(offset, offset + maxLimit);
      
      const songs = paginatedTracks.map((track) => this.mapTrackToSong(track));
      console.log(`[Spotify] Found ${songs.length} tracks (from ${allTracks.length} total)`);
      return songs;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Spotify] Search failed: ${errorMsg}`);
      
      // Handle token expiration (401 Unauthorized)
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        console.error('[Spotify] Token unauthorized - user needs to re-authenticate');
        throw new Error('Token de Spotify expirado o inválido. Por favor, autentícate nuevamente.');
      }
      throw error;
    }
  }

  async getStreamUrl(spotifyUri: string): Promise<string> {
    if (!this.sdk) {
      throw new Error('Spotify no autenticado');
    }

    const trackId = spotifyUri.split(':').pop();
    if (!trackId) {
      throw new Error('Spotify URI invalido');
    }

    const track = await this.sdk.tracks.get(trackId);
    if (!track.preview_url) {
      throw new Error('La cancion no tiene preview_url disponible');
    }

    return track.preview_url;
  }

  getSourceType(): MusicSource {
    return MusicSource.SPOTIFY;
  }

  isAuthenticated(): boolean {
    return this.sdk !== null;
  }

  getTokenInfo(): { authenticated: boolean; expiresIn: number | null; expiresAt: string | null } {
    if (!this.sdk) {
      return { authenticated: false, expiresIn: null, expiresAt: null };
    }

    if (!this.tokenExpiresAt) {
      return { authenticated: true, expiresIn: null, expiresAt: null };
    }

    const expiresIn = Math.max(0, Math.floor((this.tokenExpiresAt - Date.now()) / 1000));
    return {
      authenticated: true,
      expiresIn,
      expiresAt: new Date(this.tokenExpiresAt).toISOString(),
    };
  }

  clearTokens(): void {
    console.log("[Spotify] Clearing tokens");
    this.sdk = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
  }

  private mapTrackToSong(track: Track): Song {
    const song = new Song();
    song.id = 0;
    song.title = track.name;
    song.artist = track.artists[0]?.name ?? null;
    song.album = track.album.name;
    song.durationSeconds = Math.floor(track.duration_ms / 1000);
    song.source = MusicSource.SPOTIFY;
    song.filePathOrUri = track.uri;
    song.spotifyTrackId = track.id;
    song.coverImageUrl = track.album.images[0]?.url ?? null;
    song.playlistPosition = 0;
    return song;
  }
}
