import { Router } from 'express';
import { PlayerController } from '../controllers/PlayerController';
import { asyncWrapper } from '../middleware/asyncWrapper';

export const createPlayerRoutes = (controller: PlayerController): Router => {
  const router = Router();

  router.get('/current', asyncWrapper(controller.getCurrent.bind(controller)));
  router.post('/next', asyncWrapper(controller.nextSong.bind(controller)));
  router.post('/previous', asyncWrapper(controller.previousSong.bind(controller)));
  router.post('/play', asyncWrapper(controller.play.bind(controller)));
  router.post('/pause', asyncWrapper(controller.pause.bind(controller)));
  router.patch('/repeat', asyncWrapper(controller.setRepeatMode.bind(controller)));
  router.patch('/shuffle', asyncWrapper(controller.toggleShuffle.bind(controller)));
  router.get('/stream/:id', asyncWrapper(controller.streamAudio.bind(controller)));
  router.post('/play-now/:id', asyncWrapper(controller.playNow.bind(controller)));

  return router;
};
