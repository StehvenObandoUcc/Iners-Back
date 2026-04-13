import { DoublyLinkedPlaylist } from '../domain/ds/DoublyLinkedPlaylist';
import { SongHistory } from '../domain/ds/SongHistory';
import { UpNextQueue } from '../domain/ds/UpNextQueue';
import { RepeatMode } from '../domain/enums/RepeatMode';

export class PlayerStateService {
  private readonly playlist = new DoublyLinkedPlaylist();
  private readonly history = new SongHistory();
  private readonly upNext = new UpNextQueue();
  private repeatMode: RepeatMode = RepeatMode.NONE;
  private playing = false;

  getPlaylist(): DoublyLinkedPlaylist {
    return this.playlist;
  }

  getHistory(): SongHistory {
    return this.history;
  }

  getUpNext(): UpNextQueue {
    return this.upNext;
  }

  getRepeatMode(): RepeatMode {
    return this.repeatMode;
  }

  setRepeatMode(mode: RepeatMode): void {
    this.repeatMode = mode;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  setPlaying(value: boolean): void {
    this.playing = value;
  }
}
