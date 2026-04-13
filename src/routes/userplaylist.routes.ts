import { Router } from 'express';
import { UserPlaylistController } from '../controllers/UserPlaylistController';
import { asyncWrapper } from '../middleware/asyncWrapper';

export const createUserPlaylistRoutes = (controller: UserPlaylistController): Router => {
  const router = Router();

  router.get('/', asyncWrapper(controller.listPlaylists.bind(controller)));
  router.post('/', asyncWrapper(controller.createPlaylist.bind(controller)));
  router.get('/:id', asyncWrapper(controller.getPlaylist.bind(controller)));
  router.patch('/:id', asyncWrapper(controller.updatePlaylist.bind(controller)));
  router.delete('/:id', asyncWrapper(controller.deletePlaylist.bind(controller)));
  router.get('/:id/songs', asyncWrapper(controller.getPlaylistSongs.bind(controller)));
  router.post('/:id/songs', asyncWrapper(controller.addSong.bind(controller)));
  router.delete('/:id/songs/:songId', asyncWrapper(controller.removeSong.bind(controller)));
  router.post('/:id/load', asyncWrapper(controller.loadIntoPlayer.bind(controller)));

  return router;
};
