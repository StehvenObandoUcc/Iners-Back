import { Router } from 'express';
import { SpotifyAuthController } from '../controllers/SpotifyAuthController';
import { asyncWrapper } from '../middleware/asyncWrapper';

export const createSpotifyRoutes = (controller: SpotifyAuthController): Router => {
  const router = Router();

  router.get('/authorize', controller.authorize.bind(controller));
  router.get('/callback', asyncWrapper(controller.callback.bind(controller)));
  router.get('/status', controller.status.bind(controller));
  router.post('/logout', controller.logout.bind(controller));
  router.get('/token', controller.getToken.bind(controller));
  router.post('/play', asyncWrapper(controller.playTrack.bind(controller)));

  return router;
};
