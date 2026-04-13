import { Request, Response } from 'express';
import { ApiResponse } from '../dto/response/ApiResponse';
import { HttpError } from '../errors/HttpError';
import { SpotifyService } from '../services/SpotifyService';

export class SpotifyAuthController {
  private readonly frontendUrl: string;

  constructor(private readonly spotifyService: SpotifyService) {
    this.frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  }

  authorize(_req: Request, res: Response): void {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new HttpError(500, 'Faltan variables SPOTIFY_CLIENT_ID o SPOTIFY_REDIRECT_URI');
    }

    // Include Web Playback SDK scope for Premium users
    const scopes = [
      'user-read-private',
      'streaming',
      'user-library-read',
      'user-read-playback-state',
      'user-modify-playback-state',
    ].join(' ');

    const url =
      'https://accounts.spotify.com/authorize' +
      `?client_id=${encodeURIComponent(clientId)}` +
      '&response_type=code' +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}`;

    res.redirect(url);
  }

  async callback(req: Request, res: Response): Promise<void> {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new HttpError(500, 'Faltan variables SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET o SPOTIFY_REDIRECT_URI');
    }

    // User cancelled the auth flow in Spotify
    if (req.query.error) {
      res.redirect(`${this.frontendUrl}?spotify=cancelled`);
      return;
    }

    const code = req.query.code as string | undefined;
    if (!code) {
      res.redirect(`${this.frontendUrl}?spotify=error&reason=no_code`);
      return;
    }

    const tokenUrl = 'https://accounts.spotify.com/api/token';
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
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
      const rawError = await tokenResponse.text();
      console.error('[Spotify] Token exchange failed:', rawError);
      res.redirect(`${this.frontendUrl}?spotify=error&reason=token_exchange`);
      return;
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token: string;
    };

    this.spotifyService.setTokens(
      tokens.access_token,
      tokens.token_type,
      tokens.expires_in,
      tokens.refresh_token,
    );

    // Redirect back to the SPA with success flag
    res.redirect(`${this.frontendUrl}?spotify=connected`);
  }

  status(_req: Request, res: Response): void {
    res.status(200).json({
      success: true,
      data: { authenticated: this.spotifyService.isAuthenticated() },
      error: null,
    } satisfies ApiResponse<{ authenticated: boolean }>);
  }

  logout(_req: Request, res: Response): void {
    this.spotifyService.clearTokens();
    res.status(200).json({
      success: true,
      data: { authenticated: false },
      error: null,
    } satisfies ApiResponse<{ authenticated: boolean }>);
  }

  /** Returns the current access token so the frontend Spotify Web Playback SDK can use it. */
  getToken(_req: Request, res: Response): void {
    const accessToken = this.spotifyService.getAccessToken();
    if (!accessToken) {
      throw new HttpError(401, 'No hay sesión Spotify activa');
    }
    res.status(200).json({
      success: true,
      data: { accessToken },
      error: null,
    } satisfies ApiResponse<{ accessToken: string }>);
  }

  /** Tells Spotify to start playing a URI on a given Spotify Connect device (Premium only). */
  async playTrack(req: Request, res: Response): Promise<void> {
    const { deviceId, spotifyUri } = req.body as { deviceId?: string; spotifyUri?: string };
    if (!deviceId || !spotifyUri) {
      throw new HttpError(400, 'deviceId y spotifyUri son requeridos');
    }
    await this.spotifyService.playOnDevice(deviceId, spotifyUri);
    res.status(204).end();
  }
}
