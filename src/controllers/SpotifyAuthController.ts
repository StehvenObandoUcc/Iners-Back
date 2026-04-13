import { Request, Response } from 'express';
import { ApiResponse } from '../dto/response/ApiResponse';
import { HttpError } from '../errors/HttpError';
import { SpotifyService } from '../services/SpotifyService';

export class SpotifyAuthController {
  constructor(private readonly spotifyService: SpotifyService) {}

  authorize(_req: Request, res: Response): void {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new HttpError(500, 'Faltan variables SPOTIFY_CLIENT_ID o SPOTIFY_REDIRECT_URI');
    }

    const scope = encodeURIComponent('user-read-private streaming user-library-read');

    const url =
      'https://accounts.spotify.com/authorize' +
      `?client_id=${clientId}` +
      '&response_type=code' +
      `&redirect_uri=${encodeURIComponent(redirectUri ?? '')}` +
      `&scope=${scope}`;

    res.redirect(url);
  }

  async callback(req: Request, res: Response): Promise<void> {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new HttpError(500, 'Faltan variables SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET o SPOTIFY_REDIRECT_URI');
    }

    const code = req.query.code as string | undefined;
    if (!code) {
      res.status(400).json({ success: false, data: null, error: 'Code no encontrado' } satisfies ApiResponse<never>);
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
      res.status(400).json({ success: false, data: null, error: rawError } satisfies ApiResponse<never>);
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

    res.status(200).json({ success: true, data: { authenticated: true }, error: null } satisfies ApiResponse<{ authenticated: boolean }>);
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
}
