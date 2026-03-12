import * as vscode from 'vscode';
import * as fs from 'fs';
import { ParsedFile } from '../types';

interface CacheEntry {
  mtime: number;
  parsed: ParsedFile;
}

export class CacheManager implements vscode.Disposable {
  private cache = new Map<string, CacheEntry>();
  private watcher: vscode.FileSystemWatcher | undefined;
  private readonly _onDidInvalidate = new vscode.EventEmitter<string>();
  readonly onDidInvalidate = this._onDidInvalidate.event;

  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingInvalidations = new Set<string>();

  startWatching(): void {
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,tsx,js,jsx,yaml,yml}');
    this.watcher.onDidChange(uri => this.scheduleInvalidation(uri.fsPath));
    this.watcher.onDidCreate(uri => this.scheduleInvalidation(uri.fsPath));
    this.watcher.onDidDelete(uri => this.scheduleInvalidation(uri.fsPath));
  }

  get(filePath: string): ParsedFile | null {
    const entry = this.cache.get(filePath);
    if (!entry) { return null; }

    try {
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs > entry.mtime) {
        this.cache.delete(filePath);
        return null;
      }
      return entry.parsed;
    } catch {
      this.cache.delete(filePath);
      return null;
    }
  }

  set(filePath: string, parsed: ParsedFile): void {
    try {
      const stat = fs.statSync(filePath);
      this.cache.set(filePath, { mtime: stat.mtimeMs, parsed });
    } catch {
      // file may have been deleted between parse and cache
    }
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }

  private scheduleInvalidation(filePath: string): void {
    this.cache.delete(filePath);
    this.pendingInvalidations.add(filePath);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      for (const fp of this.pendingInvalidations) {
        this._onDidInvalidate.fire(fp);
      }
      this.pendingInvalidations.clear();
    }, 500);
  }

  dispose(): void {
    this.watcher?.dispose();
    this._onDidInvalidate.dispose();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
