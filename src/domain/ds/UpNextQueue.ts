import { Song } from '../entities/Song';

export class UpNextQueue {
  private readonly queue: Song[] = [];

  enqueue(song: Song): void {
    this.queue.push(song);
  }

  dequeue(): Song | undefined {
    return this.queue.shift();
  }

  peek(): Song | undefined {
    return this.queue[0];
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  get size(): number {
    return this.queue.length;
  }

  toArray(): Song[] {
    return [...this.queue];
  }

  removeById(songId: number): boolean {
    const index = this.queue.findIndex((song) => song.id === songId);
    if (index === -1) return false;
    this.queue.splice(index, 1);
    return true;
  }

  replace(songs: Song[]): void {
    this.queue.length = 0;
    this.queue.push(...songs);
  }

  clear(): void {
    this.queue.length = 0;
  }
}
