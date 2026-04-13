import { SongHistory } from '../../../src/domain/ds/SongHistory';
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

describe('SongHistory', () => {
  let history: SongHistory;

  beforeEach(() => {
    history = new SongHistory();
  });

  describe('isEmpty / size', () => {
    it('should be empty and size 0 on creation', () => {
      expect(history.isEmpty()).toBe(true);
      expect(history.size).toBe(0);
    });

    it('should not be empty after pushing', () => {
      history.push(createSong(1, 'Song A'));
      expect(history.isEmpty()).toBe(false);
      expect(history.size).toBe(1);
    });
  });

  describe('push / pop / peek', () => {
    it('should push a song and peek it', () => {
      const song = createSong(1, 'Song A');
      history.push(song);

      expect(history.peek()).toEqual(song);
      expect(history.size).toBe(1); // peek should not remove
    });

    it('should push multiple songs and return them in LIFO order', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      history.push(songA);
      history.push(songB);
      history.push(songC);

      expect(history.peek()).toEqual(songC);

      const popped1 = history.pop();
      expect(popped1).toEqual(songC);

      const popped2 = history.pop();
      expect(popped2).toEqual(songB);

      const popped3 = history.pop();
      expect(popped3).toEqual(songA);
    });

    it('should return undefined when popping from empty stack', () => {
      expect(history.pop()).toBeUndefined();
    });

    it('should return undefined when peeking empty stack', () => {
      expect(history.peek()).toBeUndefined();
    });
  });

  describe('MAX_SIZE limit', () => {
    it('should discard oldest song when exceeding MAX_SIZE (50)', () => {
      // Push 50 songs
      for (let i = 1; i <= 50; i++) {
        history.push(createSong(i, `Song ${i}`));
      }

      expect(history.size).toBe(50);

      // Push 51st song - should discard Song 1
      const song51 = createSong(51, 'Song 51');
      history.push(song51);

      expect(history.size).toBe(50);
      
      // The oldest (Song 1) should be discarded
      const arr = history.toArray();
      // Song 1 should not be in the stack
      expect(arr.find((s: Song) => s.id === 1)).toBeUndefined();
      // Song 51 should be the oldest (at end after reverse)
      expect(arr[arr.length - 1].id).toBe(2);
      // Song 51 should be at top (index 0 after reverse)
      expect(arr[0].id).toBe(51);
    });

    it('should maintain MAX_SIZE after many pushes', () => {
      // Push 100 songs
      for (let i = 1; i <= 100; i++) {
        history.push(createSong(i, `Song ${i}`));
      }

      expect(history.size).toBe(50);
      
      const arr = history.toArray();
      expect(arr.length).toBe(50);
      // Top should be Song 100
      expect(arr[0].id).toBe(100);
      // Oldest should be Song 51
      expect(arr[49].id).toBe(51);
    });
  });

  describe('toArray', () => {
    it('should return empty array for empty stack', () => {
      expect(history.toArray()).toEqual([]);
    });

    it('should return songs with top at index 0', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      history.push(songA);
      history.push(songB);
      history.push(songC);

      const arr = history.toArray();
      
      // Top (most recent) should be at index 0
      expect(arr[0]).toEqual(songC);
      expect(arr[1]).toEqual(songB);
      expect(arr[2]).toEqual(songA);
    });

    it('should return a copy, not the internal array', () => {
      history.push(createSong(1, 'Song A'));
      
      const arr1 = history.toArray();
      arr1.push(createSong(999, 'Fake'));
      
      const arr2 = history.toArray();
      expect(arr2.length).toBe(1); // should not be affected
    });
  });
});
