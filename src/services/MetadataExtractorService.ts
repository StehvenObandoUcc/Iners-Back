import fs from 'node:fs';
import path from 'node:path';
import * as musicMetadata from 'music-metadata';

const COVER_CANDIDATE_NAMES = ['cover', 'folder', 'front', 'album'];
const COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export interface ExtractedMetadata {
  /** Title from tags, or empty string (caller should fall back to filename) */
  title: string;
  artist: string | null;
  album: string | null;
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  genre: string | null;
  composer: string | null;
  comment: string | null;
  /** BPM rounded to integer */
  bpm: number | null;
  /** ReplayGain track gain in dB */
  replayGainTrack: number | null;
  /** ReplayGain album gain in dB */
  replayGainAlbum: number | null;
  /** Duration in seconds, rounded */
  durationSeconds: number | null;
  /** Bitrate in kbps */
  bitrate: number | null;
  /** Sample rate in Hz */
  sampleRate: number | null;
  /** Raw cover art data to be persisted by the caller */
  coverData: { data: Buffer; format: string } | null;
  /** LRC-format lyrics if available (starts with "[") */
  lyricsLrc: string | null;
  /** Plain-text lyrics */
  lyricsPlain: string | null;
}

/** Parses ReplayGain value from various formats music-metadata may return */
function parseReplayGain(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'dB' in (value as Record<string, unknown>)) {
    return typeof (value as Record<string, unknown>).dB === 'number'
      ? ((value as Record<string, unknown>).dB as number)
      : null;
  }
  if (typeof value === 'string') {
    const m = value.match(/[-+]?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  return null;
}

export class MetadataExtractorService {
  /**
   * Extract metadata from an in-memory buffer (used during upload).
   * @param buffer  Audio file bytes
   * @param mimeType  MIME type hint for the parser
   * @param originalName  Original filename for title fallback and LRC sidecar lookup
   */
  async extractFromBuffer(
    buffer: Buffer,
    mimeType: string,
    originalName: string,
  ): Promise<ExtractedMetadata> {
    try {
      const meta = await musicMetadata.parseBuffer(buffer, { mimeType });
      return this.mapCommonTags(meta, originalName);
    } catch (err) {
      console.warn('[MetadataExtractor] Failed to parse buffer:', originalName, err);
      return this.empty(originalName);
    }
  }

  /**
   * Extract metadata from a file on disk (used during seed/library scan).
   * Also checks for a sidecar .lrc file.
   */
  async extractFromFile(filePath: string): Promise<ExtractedMetadata> {
    try {
      const meta = await musicMetadata.parseFile(filePath, { skipCovers: false });
      const result = this.mapCommonTags(meta, path.basename(filePath));

      if (!result.coverData) {
        result.coverData = this.findNearbyCover(filePath);
      }

      // Sidecar .lrc lookup
      if (!result.lyricsLrc) {
        const lrcPath = filePath.replace(/\.[^.]+$/, '.lrc');
        if (fs.existsSync(lrcPath)) {
          const raw = fs.readFileSync(lrcPath, 'utf-8').trim();
          if (raw.startsWith('[')) {
            result.lyricsLrc = raw;
          } else {
            result.lyricsPlain = raw;
          }
        }
      }

      return result;
    } catch (err) {
      console.warn('[MetadataExtractor] Failed to parse file:', filePath, err);
      return this.empty(path.basename(filePath));
    }
  }

  private mapCommonTags(
    meta: musicMetadata.IAudioMetadata,
    originalName: string,
  ): ExtractedMetadata {
    const c = meta.common;
    const f = meta.format;

    // Lyrics: embedded tag may be plain or LRC
    let lyricsLrc: string | null = null;
    let lyricsPlain: string | null = null;
    const rawLyrics = c.lyrics?.[0]?.text?.trim() ?? null;
    if (rawLyrics) {
      if (rawLyrics.startsWith('[')) {
        lyricsLrc = rawLyrics;
      } else {
        lyricsPlain = rawLyrics;
      }
    }

    const coverData = (() => {
      const pic = musicMetadata.selectCover(c.picture ?? []);
      if (!pic) return null;
      return { data: Buffer.from(pic.data), format: pic.format };
    })();

    return {
      title:           c.title?.trim() ?? '',
      artist:          c.artist?.trim()        ?? c.albumartist?.trim() ?? null,
      album:           c.album?.trim()          ?? null,
      year:            c.year                   ?? null,
      trackNumber:     c.track?.no              ?? null,
      discNumber:      c.disk?.no               ?? null,
      genre:           c.genre?.[0]?.trim()     ?? null,
      composer:        c.composer?.[0]?.trim()  ?? null,
      comment:         c.comment?.[0]?.text?.trim() ?? null,
      bpm:             c.bpm != null ? Math.round(c.bpm) : null,
      replayGainTrack: parseReplayGain(c.replaygain_track_gain),
      replayGainAlbum: parseReplayGain(c.replaygain_album_gain),
      durationSeconds: f.duration != null ? Math.round(f.duration) : null,
      bitrate:         f.bitrate  != null ? Math.round(f.bitrate / 1000) : null,
      sampleRate:      f.sampleRate ?? null,
      coverData,
      lyricsLrc,
      lyricsPlain,
    };

    void originalName; // used only as fallback by caller
  }

  private findNearbyCover(filePath: string): { data: Buffer; format: string } | null {
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));
    const candidatePaths = [
      ...COVER_EXTENSIONS.map((ext) => path.join(dir, `${baseName}${ext}`)),
      ...COVER_CANDIDATE_NAMES.flatMap((name) =>
        COVER_EXTENSIONS.map((ext) => path.join(dir, `${name}${ext}`)),
      ),
    ];

    for (const candidatePath of candidatePaths) {
      if (!fs.existsSync(candidatePath)) {
        continue;
      }

      const ext = path.extname(candidatePath).toLowerCase();
      const format = this.mimeTypeForImageExtension(ext);
      if (!format) {
        continue;
      }

      return {
        data: fs.readFileSync(candidatePath),
        format,
      };
    }

    return null;
  }

  private mimeTypeForImageExtension(extension: string): string | null {
    switch (extension) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      default:
        return null;
    }
  }

  private empty(originalName: string): ExtractedMetadata {
    return {
      title: '',
      artist: null, album: null, year: null, trackNumber: null, discNumber: null,
      genre: null, composer: null, comment: null, bpm: null,
      replayGainTrack: null, replayGainAlbum: null,
      durationSeconds: null, bitrate: null, sampleRate: null,
      coverData: null, lyricsLrc: null, lyricsPlain: null,
    };
    void originalName;
  }
}
