export class Stopwatch {
  private start: number;

  constructor() {
    this.start = Date.now();
  }

  elapsed(): number {
    return Date.now() - this.start;
  }

  reset(): void {
    this.start = Date.now();
  }
}

export interface TimingEntry {
  name: string;
  duration: number;
  success: boolean;
}

export class TimingReport {
  private entries: TimingEntry[] = [];

  add(name: string, duration: number, success: boolean): void {
    this.entries.push({ name, duration, success });
  }

  getEntries(): TimingEntry[] {
    return [...this.entries];
  }

  totalDuration(): number {
    return this.entries.reduce((sum, e) => sum + e.duration, 0);
  }

  passedCount(): number {
    return this.entries.filter((e) => e.success).length;
  }

  failedCount(): number {
    return this.entries.filter((e) => !e.success).length;
  }

  totalCount(): number {
    return this.entries.length;
  }
}
