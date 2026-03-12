import * as fs from 'fs';
import * as path from 'path';

/**
 * Standalone file scanner that works without the VS Code API.
 * Used for testing and CLI usage.
 */
export function scanDirectory(
  rootDir: string,
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx'],
  excludeDirs: string[] = ['node_modules', 'dist', 'build', '.git'],
): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!excludeDirs.includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (extensions.includes(path.extname(entry.name))) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(rootDir);
  return results.sort();
}
