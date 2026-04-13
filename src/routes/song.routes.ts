import { Router } from 'express';
import multer from 'multer';
import { SongController } from '../controllers/SongController';
import { asyncWrapper } from '../middleware/asyncWrapper';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'audio/mpeg' || file.originalname.toLowerCase().endsWith('.mp3')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos MP3'));
    }
  },
});

export const createSongRoutes = (controller: SongController): Router => {
  const router = Router();

  router.get('/', asyncWrapper(controller.listSongs.bind(controller)));
  router.get('/search/local', asyncWrapper(controller.searchLocal.bind(controller)));
  router.get('/search/spotify', asyncWrapper(controller.searchSpotify.bind(controller)));
  router.post('/', asyncWrapper(controller.createSong.bind(controller)));
  router.post('/seed/local', asyncWrapper(controller.seedLocalSongs.bind(controller)));

  // Upload & Delete routes
  router.post('/upload', upload.single('audio'), asyncWrapper(controller.uploadMusic.bind(controller)));
  router.delete('/:id', asyncWrapper(controller.deleteSong.bind(controller)));

  return router;
};
