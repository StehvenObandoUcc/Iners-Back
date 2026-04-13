import { Router } from 'express';
import { AlbumController } from '../controllers/AlbumController';
import { asyncWrapper } from '../middleware/asyncWrapper';

export const createAlbumRoutes = (controller: AlbumController): Router => {
  const router = Router();

  router.get('/', asyncWrapper(controller.listAlbums.bind(controller)));
  router.get('/:id', asyncWrapper(controller.getAlbum.bind(controller)));
  router.get('/:id/songs', asyncWrapper(controller.getAlbumSongs.bind(controller)));
  router.get('/by-artist/:artistId', asyncWrapper(controller.getByArtist.bind(controller)));
  router.delete('/:id', asyncWrapper(controller.deleteAlbum.bind(controller)));

  return router;
};
