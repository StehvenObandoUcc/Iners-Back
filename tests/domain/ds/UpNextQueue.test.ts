import { UpNextQueue } from '../../../src/domain/ds/UpNextQueue';
import { Song } from '../../../src/domain/entities/Song';

function createSong(id: number, title: string): Song {
  const song = new Song();
  song.id = id;
  song.title = title;
  song.artist = 'Test Artist';
  song.album = 'Test Album';
  song.durationSeconds = 180;
  song.source = 'LOCAL' as any;
  song.filePathOrUri = `/music/${title}.mp3`;
  song.spotifyTrackId = null;
  song.coverImageUrl = null;
  song.playlistPosition = 0;
  return song;
}

describe('UpNextQueue', () => {
  let queue: UpNextQueue;

  beforeEach(() => {
    queue = new UpNextQueue();
  });

  describe('isEmpty / size', () => {
    it('should be empty and size 0 on creation', () => {
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size).toBe(0);
    });

    it('should not be empty after enqueue', () => {
      queue.enqueue(createSong(1, 'Song A'));
      expect(queue.isEmpty()).toBe(false);
      expect(queue.size).toBe(1);
    });
  });

  describe('enqueue / dequeue / peek', () => {
    it('should enqueue a song and peek it', () => {
      const song = createSong(1, 'Song A');
      queue.enqueue(song);

      expect(queue.peek()).toEqual(song);
      expect(queue.size).toBe(1); // peek should not remove
    });

    it('should dequeue in FIFO order', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      queue.enqueue(songA);
      queue.enqueue(songB);
      queue.enqueue(songC);

      expect(queue.size).toBe(3);

      const dequeued1 = queue.dequeue();
      expect(dequeued1).toEqual(songA); // first in, first out

      const dequeued2 = queue.dequeue();
      expect(dequeued2).toEqual(songB);

      const dequeued3 = queue.dequeue();
      expect(dequeued3).toEqual(songC);
    });

    it('should return undefined when dequeueing from empty queue', () => {
      expect(queue.dequeue()).toBeUndefined();
    });

    it('should return undefined when peeking empty queue', () => {
      expect(queue.peek()).toBeUndefined();
    });

    it('should maintain order after multiple enqueue/dequeue', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');

      queue.enqueue(songA);
      queue.enqueue(songB);

      queue.dequeue(); // remove songA

      expect(queue.peek()).toEqual(songB);
      expect(queue.size).toBe(1);
    });
  });

  describe('toArray', () => {
    it('should return empty array for empty queue', () => {
      expect(queue.toArray()).toEqual([]);
    });

    it('should return songs in FIFO order (front to back)', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      queue.enqueue(songA);
      queue.enqueue(songB);
      queue.enqueue(songC);

      const arr = queue.toArray();

      expect(arr[0]).toEqual(songA); // front first
      expect(arr[1]).toEqual(songB);
      expect(arr[2]).toEqual(songC); // back last
    });

    it('should return a copy, not the internal array', () => {
      queue.enqueue(createSong(1, 'Song A'));

      const arr1 = queue.toArray();
      arr1.push(createSong(999, 'Fake'));

      const arr2 = queue.toArray();
      expect(arr2.length).toBe(1); // should not be affected
    });
  });

  describe('edge cases', () => {
    it('should handle single element correctly', () => {
      const song = createSong(1, 'Song A');
      queue.enqueue(song);

      expect(queue.peek()).toEqual(song);
      expect(queue.size).toBe(1);

      const dequeued = queue.dequeue();
      expect(dequeued).toEqual(song);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeUndefined();
    });

    it('should handle interleaved enqueue and dequeue', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      queue.enqueue(songA);
      queue.enqueue(songB);
      queue.dequeue(); // remove A
      queue.enqueue(songC);

      expect(queue.size).toBe(2);
      expect(queue.peek()).toEqual(songB);

      const remaining = queue.toArray();
      expect(remaining).toEqual([songB, songC]);
    });
  });
});
