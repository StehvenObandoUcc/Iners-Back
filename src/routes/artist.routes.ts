import { Router } from 'express';
import { ArtistController } from '../controllers/ArtistController';
import { asyncWrapper } from '../middleware/asyncWrapper';

export const createArtistRoutes = (controller: ArtistController): Router => {
  const router = Router();

  router.get('/', asyncWrapper(controller.listArtists.bind(controller)));
  router.get('/:id', asyncWrapper(controller.getArtist.bind(controller)));
  router.get('/:id/songs', asyncWrapper(controller.getArtistSongs.bind(controller)));

  return router;
};
