import fs from 'node:fs';
import path from 'node:path';
import { SpotifyApi, Track } from '@spotify/web-api-ts-sdk';
import { IMusicSource } from '../domain/interfaces/IMusicSource';
import { Song } from '../domain/entities/Song';
import { MusicSource } from '../domain/enums/MusicSource';

export class SpotifyService implements IMusicSource {
  private static readonly PLAY_RETRY_DELAYS_MS = [0, 250, 750];
  private static readonly DEVICE_WAIT_DELAYS_MS = [0, 250, 750, 1500];
  private static readonly SESSION_FILE = path.resolve(process.cwd(), 'music', 'spotify-session.json');

  private sdk: SpotifyApi | null = null;
  private accessToken: string | null = null;
  private tokenType: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private clientId: string = process.env.SPOTIFY_CLIENT_ID ?? '';

  constructor() {
    this.loadPersistedSession().catch((err) => console.error('[Spotify] Initialization error:', err));
  }

  setTokens(accessToken: string, tokenType: string, expiresIn: number, refreshToken: string): void {
    this.accessToken = accessToken;
    this.tokenType = tokenType;
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
    this.persistSession();
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  /** Calls Spotify's Web API to start playback on a specific device (Premium only). */
  async playOnDevice(deviceId: string, spotifyUri: string): Promise<void> {
    await this.ensureValidToken();
    console.log(`[Spotify] Starting playback on device ${deviceId} for ${spotifyUri}`);
    await this.waitForDevice(deviceId);
    await this.transferPlayback(deviceId, true);

    let lastError: string | null = null;

    for (const delayMs of SpotifyService.PLAY_RETRY_DELAYS_MS) {
      if (delayMs > 0) {
        await this.delay(delayMs);
      }

      const response = await this.spotifyFetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uris: [spotifyUri] }),
        },
      );

      if (response.ok || response.status === 204) {
        console.log(`[Spotify] Play accepted on attempt after ${delayMs}ms`);
        return;
      }

      const raw = await response.text();
      lastError = `Spotify play failed (${response.status}): ${raw}`;
      console.warn(`[Spotify] Play attempt failed after ${delayMs}ms: ${lastError}`);

      if (response.status !== 404 && response.status !== 502 && response.status !== 503) {
        break;
      }
    }

    throw new Error(lastError ?? 'Spotify play failed for an unknown reason');
  }
  private async waitForDevice(deviceId: string): Promise<void> {
    for (const delayMs of SpotifyService.DEVICE_WAIT_DELAYS_MS) {
      if (delayMs > 0) {
        await this.delay(delayMs);
      }

      const devices = await this.getAvailableDevices();
      const match = devices.find((device) => device.id === deviceId);

      if (match) {
        console.log(
          `[Spotify] Device ready after ${delayMs}ms: ${match.name} (${match.type}) active=${match.is_active}`,
        );
        return;
      }

      console.warn(
        `[Spotify] Device ${deviceId} not available after ${delayMs}ms. Visible devices: ${devices.map((d) => `${d.name}:${d.id}`).join(', ') || 'none'}`,
      );
    }

    throw new Error(`Spotify device ${deviceId} no aparece disponible en Connect`);
  }

  private async getAvailableDevices(): Promise<Array<{ id: string | null; is_active: boolean; name: string; type: string }>> {
    const response = await this.spotifyFetch('https://api.spotify.com/v1/me/player/devices', {
      method: 'GET',
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new Error(`Spotify devices failed (${response.status}): ${raw}`);
    }

    const json = (await response.json()) as {
      devices?: Array<{ id: string | null; is_active: boolean; name: string; type: string }>;
    };

    return json.devices ?? [];
  }

  private async transferPlayback(deviceId: string, play: boolean): Promise<void> {
    const response = await this.spotifyFetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_ids: [deviceId],
        play,
      }),
    });

    if (!response.ok && response.status !== 204) {
      const raw = await response.text();
      throw new Error(`Spotify transfer playback failed (${response.status}): ${raw}`);
    }

    console.log(`[Spotify] Playback transferred to device ${deviceId} with play=${play}`);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return true; // Treat missing expiration as expired if we are tracking it, but wait, let's say true if it's less than 5 minutes out
    return Date.now() >= this.tokenExpiresAt - 5 * 60 * 1000;
  }

  private async ensureValidToken(): Promise<void> {
    if (this.isTokenExpired() && this.refreshToken) {
      console.log('[Spotify] Token is expired or about to expire, refreshing automatically...');
      await this.refreshTokens(this.refreshToken);
    }
  }

  private async spotifyFetch(url: string, init: RequestInit): Promise<Response> {
    await this.ensureValidToken();
    if (!this.accessToken) {
      throw new Error('Spotify no autenticado');
    }

    return fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(init.headers ?? {}),
      },
    });
  }

  async search(query: string, limit: number = 20, offset: number = 0): Promise<Song[]> {
    await this.ensureValidToken();
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
    await this.ensureValidToken();
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
    this.accessToken = null;
    this.tokenType = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
    this.deletePersistedSession();
  }

  private async loadPersistedSession(): Promise<void> {
    try {
      const explicitRefreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
      let session: {
        accessToken?: string;
        tokenType?: string;
        refreshToken?: string;
        expiresAt?: number;
      } = {};

      if (fs.existsSync(SpotifyService.SESSION_FILE)) {
        const raw = fs.readFileSync(SpotifyService.SESSION_FILE, 'utf8');
        session = JSON.parse(raw);
      }

      const refreshTokenToUse = session.refreshToken || explicitRefreshToken;

      // If we have a refresh token but it's expired or missing an access token, refresh it
      if (refreshTokenToUse) {
        const nowMs = Date.now();
        const expiresAt = session.expiresAt || 0;
        
        // If expired or missing token data
        if (!session.accessToken || !session.tokenType || expiresAt <= nowMs) {
           console.log('[Spotify] Token missing or expired, attempting to refresh...');
           const success = await this.refreshTokens(refreshTokenToUse);
           if (!success) {
             console.warn('[Spotify] Could not refresh token. Session cleared.');
             this.deletePersistedSession();
           }
           return;
        }

        const expiresIn = Math.max(0, Math.floor((expiresAt - nowMs) / 1000));
        this.accessToken = session.accessToken ?? null;
        this.tokenType = session.tokenType ?? null;
        this.refreshToken = session.refreshToken ?? explicitRefreshToken ?? null;
        this.tokenExpiresAt = session.expiresAt ?? null;
        this.sdk = SpotifyApi.withAccessToken(this.clientId, {
          access_token: session.accessToken!,
          token_type: session.tokenType!,
          expires_in: expiresIn,
          refresh_token: this.refreshToken!,
        });
        console.log(`[Spotify] Restored session, expires at ${new Date(expiresAt).toISOString()}`);
        return;
      }
    } catch (error) {
      console.warn('[Spotify] Failed to restore persisted session:', error);
    }
  }

  private async refreshTokens(refreshToken: string): Promise<boolean> {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.warn('[Spotify] Missing client credentials to refresh token');
      return false;
    }

    try {
      const tokenUrl = 'https://accounts.spotify.com/api/token';
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!tokenResponse.ok) {
        console.error('[Spotify] Failed to refresh token:', await tokenResponse.text());
        return false;
      }

      const tokens = (await tokenResponse.json()) as {
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token?: string; // Sometimes refresh_token is re-issued
      };

      this.setTokens(tokens.access_token, tokens.token_type, tokens.expires_in, tokens.refresh_token || refreshToken);
      return true;
    } catch (e) {
      console.error('[Spotify] Exception during token refresh:', e);
      return false;
    }
  }

  private persistSession(): void {
    if (!this.accessToken || !this.tokenType || !this.refreshToken || !this.tokenExpiresAt) {
      return;
    }

    const dir = path.dirname(SpotifyService.SESSION_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(
      SpotifyService.SESSION_FILE,
      JSON.stringify({
        accessToken: this.accessToken,
        tokenType: this.tokenType,
        refreshToken: this.refreshToken,
        expiresAt: this.tokenExpiresAt,
      }, null, 2),
      'utf8',
    );
  }

  private deletePersistedSession(): void {
    if (fs.existsSync(SpotifyService.SESSION_FILE)) {
      fs.unlinkSync(SpotifyService.SESSION_FILE);
    }
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
