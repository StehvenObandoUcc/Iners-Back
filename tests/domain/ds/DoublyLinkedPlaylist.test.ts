import { DoublyLinkedPlaylist } from '../../../src/domain/ds/DoublyLinkedPlaylist';
import { Song } from '../../../src/domain/entities/Song';
import { RepeatMode } from '../../../src/domain/enums/RepeatMode';

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

describe('DoublyLinkedPlaylist', () => {
  let playlist: DoublyLinkedPlaylist;

  beforeEach(() => {
    playlist = new DoublyLinkedPlaylist();
  });

  describe('isEmpty / size', () => {
    it('should be empty and size 0 on creation', () => {
      expect(playlist.isEmpty()).toBe(true);
      expect(playlist.size).toBe(0);
    });

    it('should not be empty after adding a song', () => {
      playlist.addLast(createSong(1, 'Song A'));
      expect(playlist.isEmpty()).toBe(false);
      expect(playlist.size).toBe(1);
    });
  });

  describe('addFirst', () => {
    it('should add first song to empty list and set as current', () => {
      const song = createSong(1, 'Song A');
      playlist.addFirst(song);

      expect(playlist.size).toBe(1);
      expect(playlist.getCurrent()).toEqual(song);
      expect(playlist.toArray()).toEqual([song]);
    });

    it('should add multiple songs at first, maintaining order', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      playlist.addFirst(songA);
      playlist.addFirst(songB);
      playlist.addFirst(songC);

      expect(playlist.size).toBe(3);
      expect(playlist.toArray()).toEqual([songC, songB, songA]);
      expect(playlist.getCurrent()).toEqual(songA); // current stays at first song added (songA)
    });
  });

  describe('addLast', () => {
    it('should add last song to empty list', () => {
      const song = createSong(1, 'Song A');
      playlist.addLast(song);

      expect(playlist.size).toBe(1);
      expect(playlist.getCurrent()).toEqual(song);
      expect(playlist.toArray()).toEqual([song]);
    });

    it('should add multiple songs at last, maintaining order', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      playlist.addLast(songA);
      playlist.addLast(songB);
      playlist.addLast(songC);

      expect(playlist.size).toBe(3);
      expect(playlist.toArray()).toEqual([songA, songB, songC]);
    });
  });

  describe('addAt', () => {
    it('should delegate to addFirst when position is 0', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');

      playlist.addLast(songA);
      playlist.addAt(0, songB);

      expect(playlist.toArray()).toEqual([songB, songA]);
    });

    it('should delegate to addLast when position equals size', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');

      playlist.addLast(songA);
      playlist.addAt(1, songB);

      expect(playlist.toArray()).toEqual([songA, songB]);
    });

    it('should insert at middle position correctly', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      playlist.addLast(songA);
      playlist.addLast(songB);
      playlist.addAt(1, songC);

      expect(playlist.size).toBe(3);
      expect(playlist.toArray()).toEqual([songA, songC, songB]);
    });

    it('should throw on negative position', () => {
      const song = createSong(1, 'Song A');
      expect(() => playlist.addAt(-1, song)).toThrow('Position out of bounds');
    });

    it('should throw on position greater than size', () => {
      const song = createSong(1, 'Song A');
      playlist.addLast(song);
      expect(() => playlist.addAt(2, createSong(2, 'Song B'))).toThrow('Position out of bounds');
    });
  });

  describe('removeById', () => {
    it('should return false when list is empty', () => {
      expect(playlist.removeById(1)).toBe(false);
    });

    it('should return false when song does not exist', () => {
      playlist.addLast(createSong(1, 'Song A'));
      expect(playlist.removeById(999)).toBe(false);
    });

    it('should remove the only song and reset state', () => {
      const song = createSong(1, 'Song A');
      playlist.addLast(song);
      
      const result = playlist.removeById(1);
      
      expect(result).toBe(true);
      expect(playlist.isEmpty()).toBe(true);
      expect(playlist.getCurrent()).toBeNull();
    });

    it('should remove head and update current if needed', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      playlist.addLast(songA);
      playlist.addLast(songB);
      playlist.addLast(songC);

      const result = playlist.removeById(1);
      
      expect(result).toBe(true);
      expect(playlist.size).toBe(2);
      expect(playlist.toArray()).toEqual([songB, songC]);
    });

    it('should remove tail correctly', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      playlist.addLast(songA);
      playlist.addLast(songB);
      playlist.addLast(songC);

      const result = playlist.removeById(3);
      
      expect(result).toBe(true);
      expect(playlist.size).toBe(2);
      expect(playlist.toArray()).toEqual([songA, songB]);
    });

    it('should remove middle node correctly', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      playlist.addLast(songA);
      playlist.addLast(songB);
      playlist.addLast(songC);

      const result = playlist.removeById(2);
      
      expect(result).toBe(true);
      expect(playlist.size).toBe(2);
      expect(playlist.toArray()).toEqual([songA, songC]);
    });

    it('should move current to next when removing current node', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      playlist.addLast(songA);
      playlist.addLast(songB);
      playlist.addLast(songC);

      // current is songA (first added)
      playlist.removeById(1);
      
      // current should now be songB
      expect(playlist.getCurrent()).toEqual(songB);
    });
  });

  describe('next', () => {
    it('should return null when list is empty', () => {
      expect(playlist.next(RepeatMode.NONE)).toBeNull();
    });

    it('should move to next song with mode NONE', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      playlist.addLast(songA);
      playlist.addLast(songB);
      playlist.addLast(songC);

      expect(playlist.getCurrent()).toEqual(songA);
      
      const nextSong = playlist.next(RepeatMode.NONE);
      expect(nextSong).toEqual(songB);
      expect(playlist.getCurrent()).toEqual(songB);
    });

    it('should return null at end with mode NONE', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');

      playlist.addLast(songA);
      playlist.addLast(songB);

      playlist.next(RepeatMode.NONE); // move to songB
      const result = playlist.next(RepeatMode.NONE); // at end, should return null
      
      expect(result).toBeNull();
    });

    it('should repeat same song with mode ONE', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');

      playlist.addLast(songA);
      playlist.addLast(songB);

      const result1 = playlist.next(RepeatMode.ONE);
      expect(result1).toEqual(songA); // stays on current

      const result2 = playlist.next(RepeatMode.ONE);
      expect(result2).toEqual(songA); // still same
    });

    it('should wrap to head with mode ALL at end', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      playlist.addLast(songA);
      playlist.addLast(songB);
      playlist.addLast(songC);

      playlist.next(RepeatMode.ALL); // to songB
      playlist.next(RepeatMode.ALL); // to songC
      const wrapped = playlist.next(RepeatMode.ALL); // should wrap to songA
      
      expect(wrapped).toEqual(songA);
    });
  });

  describe('previous', () => {
    it('should return null when list is empty', () => {
      expect(playlist.previous()).toBeNull();
    });

    it('should return null at head (no previous)', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');

      playlist.addLast(songA);
      playlist.addLast(songB);

      expect(playlist.previous()).toBeNull();
    });

    it('should move to previous song in middle', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      playlist.addLast(songA);
      playlist.addLast(songB);
      playlist.addLast(songC);

      playlist.next(RepeatMode.NONE); // current = songB
      playlist.next(RepeatMode.NONE); // current = songC
      
      const prev = playlist.previous();
      expect(prev).toEqual(songB);
      expect(playlist.getCurrent()).toEqual(songB);
    });
  });

  describe('getCurrent', () => {
    it('should return null when list is empty', () => {
      expect(playlist.getCurrent()).toBeNull();
    });

    it('should return current song without moving pointer', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');

      playlist.addLast(songA);
      playlist.addLast(songB);

      const current1 = playlist.getCurrent();
      expect(current1).toEqual(songA);

      const current2 = playlist.getCurrent();
      expect(current2).toEqual(songA); // should not change
    });
  });

  describe('setCurrent', () => {
    it('should return null when list is empty', () => {
      const song = createSong(1, 'Song A');
      expect(playlist.setCurrent(song)).toBeNull();
    });

    it('should set current to existing song', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      playlist.addLast(songA);
      playlist.addLast(songB);
      playlist.addLast(songC);

      const result = playlist.setCurrent(songC);
      
      expect(result).toEqual(songC);
      expect(playlist.getCurrent()).toEqual(songC);
    });

    it('should return null for non-existing song', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const nonExisting = createSong(999, 'Non Existing');

      playlist.addLast(songA);
      playlist.addLast(songB);

      expect(playlist.setCurrent(nonExisting)).toBeNull();
    });
  });

  describe('toArray', () => {
    it('should return empty array for empty list', () => {
      expect(playlist.toArray()).toEqual([]);
    });

    it('should return all songs from head to tail', () => {
      const songA = createSong(1, 'Song A');
      const songB = createSong(2, 'Song B');
      const songC = createSong(3, 'Song C');

      playlist.addLast(songA);
      playlist.addLast(songB);
      playlist.addLast(songC);

      expect(playlist.toArray()).toEqual([songA, songB, songC]);
    });
  });
});
