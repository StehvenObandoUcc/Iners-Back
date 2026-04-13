import { Router } from 'express';
import { PlaylistController } from '../controllers/PlaylistController';
import { asyncWrapper } from '../middleware/asyncWrapper';

export const createPlaylistRoutes = (controller: PlaylistController): Router => {
  const router = Router();

  router.get('/', asyncWrapper(controller.getPlaylist.bind(controller)));
  router.post('/add/first', asyncWrapper(controller.addSongFirst.bind(controller)));
  router.post('/add/last', asyncWrapper(controller.addSongLast.bind(controller)));
  router.post('/add/at/:position', asyncWrapper(controller.addSongAt.bind(controller)));
  router.post('/load', asyncWrapper(controller.loadCollection.bind(controller)));
  router.delete('/:id', asyncWrapper(controller.removeSong.bind(controller)));
  router.post('/up-next/:id', asyncWrapper(controller.enqueueUpNext.bind(controller)));
  router.put('/up-next', asyncWrapper(controller.replaceUpNext.bind(controller)));

  return router;
};
