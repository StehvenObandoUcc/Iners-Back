import { Song } from '../entities/Song';

export class SongHistory {
  private readonly stack: Song[] = [];
  private static readonly MAX_SIZE = 50;

  push(song: Song): void {
    this.stack.push(song);
    if (this.stack.length > SongHistory.MAX_SIZE) {
      this.stack.shift();
    }
  }

  pop(): Song | undefined {
    return this.stack.pop();
  }

  peek(): Song | undefined {
    return this.stack[this.stack.length - 1];
  }

  isEmpty(): boolean {
    return this.stack.length === 0;
  }

  get size(): number {
    return this.stack.length;
  }

  toArray(): Song[] {
    return [...this.stack].reverse();
  }
}
