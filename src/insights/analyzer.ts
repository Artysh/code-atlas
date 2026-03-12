import * as path from 'path';
import { ParsedFile, Insight, InsightSeverity } from '../types';

export class Analyzer {
  analyze(parsedFiles: ParsedFile[], workspaceRoot: string): Insight[] {
    const insights: Insight[] = [];

    const depMap = this.buildDependencyMap(parsedFiles, workspaceRoot);

    insights.push(...this.findCircularDependencies(depMap, workspaceRoot));
    insights.push(...this.findHighCoupling(depMap, parsedFiles, workspaceRoot));
    insights.push(...this.findOrphanedFiles(depMap, parsedFiles, workspaceRoot));
    insights.push(...this.findHotspots(depMap, parsedFiles, workspaceRoot));

    return insights;
  }

  /** Build a map of filePath -> [resolved dependency file paths]. */
  private buildDependencyMap(
    parsedFiles: ParsedFile[],
    root: string,
  ): Map<string, string[]> {
    const filePaths = new Set(parsedFiles.map(f => f.filePath));
    const depMap = new Map<string, string[]>();

    for (const file of parsedFiles) {
      const deps: string[] = [];
      for (const imp of file.imports) {
        if (!imp.source.startsWith('.') && !imp.source.startsWith('/')) {
          continue;
        }
        const resolved = this.resolveImport(file.filePath, imp.source, filePaths);
        if (resolved) {
          deps.push(resolved);
        }
      }
      depMap.set(file.filePath, deps);
    }

    return depMap;
  }

  /** Detect circular dependencies using DFS-based cycle detection. */
  private findCircularDependencies(
    depMap: Map<string, string[]>,
    root: string,
  ): Insight[] {
    const insights: Insight[] = [];
    const visited = new Set<string>();
    const onStack = new Set<string>();
    const foundCycles = new Set<string>();

    const dfs = (node: string, pathStack: string[]): void => {
      visited.add(node);
      onStack.add(node);
      pathStack.push(node);

      const deps = depMap.get(node) || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          dfs(dep, [...pathStack]);
        } else if (onStack.has(dep)) {
          const cycleStart = pathStack.indexOf(dep);
          if (cycleStart !== -1) {
            const cycle = pathStack.slice(cycleStart);
            const cycleKey = [...cycle].sort().join('|');
            if (!foundCycles.has(cycleKey)) {
              foundCycles.add(cycleKey);
              const relCycle = cycle.map(f => path.relative(root, f));
              insights.push({
                id: `circular-${insights.length}`,
                type: 'circularDependency',
                severity: 'error',
                title: 'Circular Dependency Detected',
                description: `Cycle: ${relCycle.join(' -> ')} -> ${relCycle[0]}`,
                affectedNodes: cycle,
              });
            }
          }
        }
      }

      onStack.delete(node);
    };

    for (const node of depMap.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return insights;
  }

  /**
   * Identify highly-coupled modules.
   * A file with high afferent coupling (many dependents) combined with
   * high efferent coupling (many dependencies) is unstable and risky.
   */
  private findHighCoupling(
    depMap: Map<string, string[]>,
    parsedFiles: ParsedFile[],
    root: string,
  ): Insight[] {
    const insights: Insight[] = [];

    const afferent = new Map<string, number>();
    const efferent = new Map<string, number>();

    for (const [file, deps] of depMap.entries()) {
      efferent.set(file, deps.length);
      for (const dep of deps) {
        afferent.set(dep, (afferent.get(dep) || 0) + 1);
      }
    }

    const threshold = Math.max(5, Math.floor(parsedFiles.length * 0.1));

    for (const file of parsedFiles) {
      const aff = afferent.get(file.filePath) || 0;
      const eff = efferent.get(file.filePath) || 0;
      const total = aff + eff;

      if (total >= threshold) {
        const relPath = path.relative(root, file.filePath);
        const severity: InsightSeverity = total >= threshold * 2 ? 'error' : 'warning';
        insights.push({
          id: `coupling-${file.filePath}`,
          type: 'highCoupling',
          severity,
          title: `High Coupling: ${relPath}`,
          description: `${aff} dependents (afferent), ${eff} dependencies (efferent). Total coupling: ${total}.`,
          affectedNodes: [file.filePath],
        });
      }
    }

    return insights;
  }

  /** Find files that neither import nor are imported by other project files. */
  private findOrphanedFiles(
    depMap: Map<string, string[]>,
    parsedFiles: ParsedFile[],
    root: string,
  ): Insight[] {
    const insights: Insight[] = [];
    const importedFiles = new Set<string>();

    for (const deps of depMap.values()) {
      for (const dep of deps) {
        importedFiles.add(dep);
      }
    }

    for (const file of parsedFiles) {
      const deps = depMap.get(file.filePath) || [];
      const isImported = importedFiles.has(file.filePath);
      const hasDeps = deps.length > 0;

      if (!isImported && !hasDeps && file.symbols.length > 0) {
        const relPath = path.relative(root, file.filePath);
        insights.push({
          id: `orphan-${file.filePath}`,
          type: 'orphanedFile',
          severity: 'info',
          title: `Orphaned File: ${relPath}`,
          description: `This file has no imports from or exports to other project files.`,
          affectedNodes: [file.filePath],
        });
      }
    }

    return insights;
  }

  /** Find dependency hotspots (most-imported files). */
  private findHotspots(
    depMap: Map<string, string[]>,
    parsedFiles: ParsedFile[],
    root: string,
  ): Insight[] {
    const insights: Insight[] = [];
    const importCounts = new Map<string, number>();

    for (const deps of depMap.values()) {
      for (const dep of deps) {
        importCounts.set(dep, (importCounts.get(dep) || 0) + 1);
      }
    }

    const hotspotThreshold = Math.max(5, Math.floor(parsedFiles.length * 0.15));

    const sorted = [...importCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .filter(([, count]) => count >= hotspotThreshold);

    for (const [file, count] of sorted.slice(0, 10)) {
      const relPath = path.relative(root, file);
      insights.push({
        id: `hotspot-${file}`,
        type: 'hotspot',
        severity: 'warning',
        title: `Dependency Hotspot: ${relPath}`,
        description: `Imported by ${count} files. Changes here have wide impact.`,
        affectedNodes: [file],
      });
    }

    return insights;
  }

  private resolveImport(fromFile: string, importPath: string, allFiles: Set<string>): string | null {
    const dir = path.dirname(fromFile);
    const resolved = path.resolve(dir, importPath);
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];

    if (allFiles.has(resolved)) { return resolved; }

    for (const ext of extensions) {
      const withExt = resolved + ext;
      if (allFiles.has(withExt)) { return withExt; }
    }

    for (const ext of extensions) {
      const indexPath = path.join(resolved, `index${ext}`);
      if (allFiles.has(indexPath)) { return indexPath; }
    }

    return null;
  }
}
