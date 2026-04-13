import { Song } from '../entities/Song';

export class PlaylistNode {
  song: Song;
  prev: PlaylistNode | null;
  next: PlaylistNode | null;

  constructor(song: Song) {
    this.song = song;
    this.prev = null;
    this.next = null;
  }
}
