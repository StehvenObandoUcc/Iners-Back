import 'reflect-metadata';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { dataSource } from './data-source';
import { AlbumController } from './controllers/AlbumController';
import { ArtistController } from './controllers/ArtistController';
import { PlayerController } from './controllers/PlayerController';
import { PlaylistController } from './controllers/PlaylistController';
import { SpotifyAuthController } from './controllers/SpotifyAuthController';
import { SongController } from './controllers/SongController';
import { UserPlaylistController } from './controllers/UserPlaylistController';
import { errorHandler } from './middleware/errorHandler';
import { AlbumRepository } from './repositories/AlbumRepository';
import { ArtistRepository } from './repositories/ArtistRepository';
import { LyricsRepository } from './repositories/LyricsRepository';
import { PlaybackStateRepository } from './repositories/PlaybackStateRepository';
import { SongRepository } from './repositories/SongRepository';
import { UserPlaylistRepository } from './repositories/UserPlaylistRepository';
import { createAlbumRoutes } from './routes/album.routes';
import { createArtistRoutes } from './routes/artist.routes';
import { createPlayerRoutes } from './routes/player.routes';
import { createPlaylistRoutes } from './routes/playlist.routes';
import { createSongRoutes } from './routes/song.routes';
import { createSpotifyRoutes } from './routes/spotify.routes';
import { createUserPlaylistRoutes } from './routes/userplaylist.routes';
import { LocalMusicService } from './services/LocalMusicService';
import { MetadataExtractorService } from './services/MetadataExtractorService';
import { PlayerStateService } from './services/PlayerStateService';
import { PlaylistService } from './services/PlaylistService';
import { SongCatalogService } from './services/SongCatalogService';
import { SpotifyService } from './services/SpotifyService';

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Serve local audio files and cover art as static files
const musicDir = path.resolve(process.cwd(), 'music');
app.use('/music', express.static(musicDir));
app.use('/covers', express.static(path.join(musicDir, 'covers')));

const bootstrap = async (): Promise<void> => {
  await dataSource.initialize();

  // ── Repositories ────────────────────────────────────────────────────────────
  const songRepository         = new SongRepository(dataSource);
  const artistRepository       = new ArtistRepository(dataSource);
  const albumRepository        = new AlbumRepository(dataSource);
  const lyricsRepository       = new LyricsRepository(dataSource);
  const userPlaylistRepository = new UserPlaylistRepository(dataSource);
  const playbackStateRepo      = new PlaybackStateRepository(dataSource);

  // ── Services ─────────────────────────────────────────────────────────────────
  const playerStateService  = new PlayerStateService();
  const localMusicService   = new LocalMusicService(songRepository);
  const spotifyService      = new SpotifyService();
  const playlistService = new PlaylistService(
    playerStateService,
    songRepository,
    localMusicService,
    spotifyService,
    playbackStateRepo,
  );

  const metadataExtractor   = new MetadataExtractorService();
  const songCatalogService  = new SongCatalogService(
    songRepository,
    artistRepository,
    albumRepository,
    lyricsRepository,
    metadataExtractor,
    playlistService,
    userPlaylistRepository,
  );

  await songCatalogService.pruneMissingLocalFiles();
  await playlistService.loadFromDB();

  // ── Controllers ──────────────────────────────────────────────────────────────
  const playlistController     = new PlaylistController(playlistService);
  const playerController       = new PlayerController(playlistService, playerStateService, localMusicService, songRepository);
  const spotifyAuthController  = new SpotifyAuthController(spotifyService);
  const songController         = new SongController(songCatalogService, localMusicService, spotifyService, metadataExtractor, lyricsRepository);
  const artistController       = new ArtistController(artistRepository, songRepository);
  const albumController        = new AlbumController(albumRepository, songRepository, songCatalogService);
  const userPlaylistController = new UserPlaylistController(userPlaylistRepository, playlistService, songCatalogService);

  // ── Routes ───────────────────────────────────────────────────────────────────
  app.use('/api/playlist',  createPlaylistRoutes(playlistController));
  app.use('/api/player',    createPlayerRoutes(playerController));
  app.use('/api/songs',     createSongRoutes(songController));
  app.use('/api/artists',   createArtistRoutes(artistController));
  app.use('/api/albums',    createAlbumRoutes(albumController));
  app.use('/api/playlists', createUserPlaylistRoutes(userPlaylistController));
  app.use('/auth/spotify',  createSpotifyRoutes(spotifyAuthController));

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(errorHandler);

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const host = process.env.HOST || '0.0.0.0';
  app.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}`);
  });
};

void bootstrap();

export default app;
