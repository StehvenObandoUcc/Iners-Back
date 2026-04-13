import 'reflect-metadata';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { dataSource } from './data-source';
import { PlayerController } from './controllers/PlayerController';
import { PlaylistController } from './controllers/PlaylistController';
import { SpotifyAuthController } from './controllers/SpotifyAuthController';
import { SongController } from './controllers/SongController';
import { errorHandler } from './middleware/errorHandler';
import { SongRepository } from './repositories/SongRepository';
import { createPlayerRoutes } from './routes/player.routes';
import { createPlaylistRoutes } from './routes/playlist.routes';
import { createSongRoutes } from './routes/song.routes';
import { createSpotifyRoutes } from './routes/spotify.routes';
import { LocalMusicService } from './services/LocalMusicService';
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

const bootstrap = async (): Promise<void> => {
  await dataSource.initialize();

  const songRepository = new SongRepository(dataSource);
  const playerStateService = new PlayerStateService();
  const localMusicService = new LocalMusicService(songRepository);
  const spotifyService = new SpotifyService();
  const songCatalogService = new SongCatalogService(songRepository);

  const playlistService = new PlaylistService(
    playerStateService,
    songRepository,
    localMusicService,
    spotifyService,
  );

  await playlistService.loadFromDB();

  const playlistController = new PlaylistController(playlistService);
  const playerController = new PlayerController(
    playlistService,
    playerStateService,
    localMusicService,
    songRepository,
  );
  const spotifyAuthController = new SpotifyAuthController(spotifyService);
  const songController = new SongController(songCatalogService, localMusicService, spotifyService);

  app.use('/api/playlist', createPlaylistRoutes(playlistController));
  app.use('/api/player', createPlayerRoutes(playerController));
  app.use('/api/songs', createSongRoutes(songController));
  app.use('/auth/spotify', createSpotifyRoutes(spotifyAuthController));

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(errorHandler);

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

void bootstrap();

export default app;
