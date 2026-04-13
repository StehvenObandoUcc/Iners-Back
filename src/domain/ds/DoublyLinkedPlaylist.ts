import { Song } from '../entities/Song';
import { RepeatMode } from '../enums/RepeatMode';
import { PlaylistNode } from './PlaylistNode';

export class DoublyLinkedPlaylist {
  private head: PlaylistNode | null = null;
  private tail: PlaylistNode | null = null;
  private current: PlaylistNode | null = null;
  private _size = 0;

  addFirst(song: Song): void {
    const node = new PlaylistNode(song);

    if (this.isEmpty()) {
      this.head = node;
      this.tail = node;
      this.current = node;
      this._size = 1;
      return;
    }

    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    this._size += 1;
  }

  addLast(song: Song): void {
    const node = new PlaylistNode(song);

    if (this.isEmpty()) {
      this.head = node;
      this.tail = node;
      this.current = node;
      this._size = 1;
      return;
    }

    node.prev = this.tail;
    if (this.tail) {
      this.tail.next = node;
    }
    this.tail = node;
    this._size += 1;
  }

  addAt(position: number, song: Song): void {
    if (position < 0 || position > this._size) {
      throw new Error('Position out of bounds');
    }

    if (position === 0) {
      this.addFirst(song);
      return;
    }

    if (position === this._size) {
      this.addLast(song);
      return;
    }

    let cursor = this.head;
    let index = 0;
    while (cursor && index < position) {
      cursor = cursor.next;
      index += 1;
    }

    if (!cursor) {
      throw new Error('Position out of bounds');
    }

    const node = new PlaylistNode(song);
    const prevNode = cursor.prev;

    node.next = cursor;
    node.prev = prevNode;

    if (prevNode) {
      prevNode.next = node;
    }
    cursor.prev = node;

    this._size += 1;
  }

  removeById(songId: number): boolean {
    if (this.isEmpty()) {
      return false;
    }

    let cursor = this.head;
    while (cursor) {
      if (cursor.song.id === songId) {
        const prevNode = cursor.prev;
        const nextNode = cursor.next;

        if (this.current === cursor) {
          this.current = nextNode ?? prevNode;
        }

        if (prevNode) {
          prevNode.next = nextNode;
        } else {
          this.head = nextNode;
        }

        if (nextNode) {
          nextNode.prev = prevNode;
        } else {
          this.tail = prevNode;
        }

        this._size -= 1;

        if (this._size === 0) {
          this.head = null;
          this.tail = null;
          this.current = null;
        }

        return true;
      }
      cursor = cursor.next;
    }

    return false;
  }

  next(mode: RepeatMode): Song | null {
    if (this.isEmpty()) {
      return null;
    }

    if (!this.current) {
      this.current = this.head;
      return this.current ? this.current.song : null;
    }

    if (mode === RepeatMode.ONE) {
      return this.current.song;
    }

    if (this.current.next) {
      this.current = this.current.next;
      return this.current.song;
    }

    if (mode === RepeatMode.ALL && this.head) {
      this.current = this.head;
      return this.current.song;
    }

    return null;
  }

  previous(): Song | null {
    if (this.isEmpty() || !this.current || !this.current.prev) {
      return null;
    }

    this.current = this.current.prev;
    return this.current.song;
  }

  getCurrent(): Song | null {
    if (this.isEmpty() || !this.current) {
      return null;
    }
    return this.current.song;
  }

  setCurrent(song: Song): Song | null {
    if (this.isEmpty()) {
      return null;
    }

    let cursor = this.head;
    while (cursor) {
      if (cursor.song.id === song.id) {
        this.current = cursor;
        return this.current.song;
      }
      cursor = cursor.next;
    }

    return null;
  }

  toArray(): Song[] {
    const result: Song[] = [];
    let cursor = this.head;
    while (cursor) {
      result.push(cursor.song);
      cursor = cursor.next;
    }
    return result;
  }

  get size(): number {
    return this._size;
  }

  isEmpty(): boolean {
    return this._size === 0;
  }
}
