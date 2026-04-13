import { Router } from 'express';
import multer from 'multer';
import { SongController } from '../controllers/SongController';
import { asyncWrapper } from '../middleware/asyncWrapper';

const ALLOWED_MIMES = new Set([
  'audio/mpeg',       // mp3
  'audio/flac',       // flac
  'audio/x-flac',     // flac alt
  'audio/wav',        // wav
  'audio/x-wav',      // wav alt
  'audio/ogg',        // ogg
  'audio/vorbis',     // ogg alt
  'audio/mp4',        // m4a
  'audio/x-m4a',      // m4a alt
  'audio/aac',        // aac
  'application/ogg',  // ogg container
]);

const ALLOWED_EXTS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB max
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (ALLOWED_MIMES.has(file.mimetype) || ALLOWED_EXTS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato no soportado: ${ext}. Acepto MP3, FLAC, WAV, OGG, M4A`));
    }
  },
});

export const createSongRoutes = (controller: SongController): Router => {
  const router = Router();

  router.get('/', asyncWrapper(controller.listSongs.bind(controller)));
  router.get('/favorites', asyncWrapper(controller.listFavorites.bind(controller)));
  router.get('/search/local', asyncWrapper(controller.searchLocal.bind(controller)));
  router.get('/search/spotify', asyncWrapper(controller.searchSpotify.bind(controller)));
  router.get('/:id/lyrics', asyncWrapper(controller.getLyrics.bind(controller)));
  router.post('/', asyncWrapper(controller.createSong.bind(controller)));
  router.post('/seed/local', asyncWrapper(controller.seedLocalSongs.bind(controller)));
  router.post('/upload', upload.single('audio'), asyncWrapper(controller.uploadMusic.bind(controller)));
  router.patch('/:id', asyncWrapper(controller.updateSong.bind(controller)));
  router.patch('/:id/favorite', asyncWrapper(controller.toggleFavorite.bind(controller)));
  router.delete('/:id', asyncWrapper(controller.deleteSong.bind(controller)));

  return router;
};
