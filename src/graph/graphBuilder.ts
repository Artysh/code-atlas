import * as path from 'path';
import { ParsedFile, ParsedRoute, CyNodeData, CyEdgeData, ViewType, NodeType } from '../types';

export class GraphBuilder {
  private fileMap = new Map<string, ParsedFile>();
  private routeMap = new Map<string, ParsedRoute[]>();

  build(
    parsedFiles: ParsedFile[],
    routes: ParsedRoute[],
    viewType: ViewType,
    workspaceRoot: string,
  ): { nodes: CyNodeData[]; edges: CyEdgeData[] } {
    this.fileMap.clear();
    this.routeMap.clear();

    for (const file of parsedFiles) {
      this.fileMap.set(file.filePath, file);
    }
    for (const route of routes) {
      const arr = this.routeMap.get(route.filePath) || [];
      arr.push(route);
      this.routeMap.set(route.filePath, arr);
    }

    switch (viewType) {
      case 'dependency': return this.buildDependencyGraph(parsedFiles, workspaceRoot);
      case 'callGraph': return this.buildCallGraph(parsedFiles, workspaceRoot);
      case 'componentTree': return this.buildComponentTree(parsedFiles, workspaceRoot);
      case 'routeMap': return this.buildRouteMap(parsedFiles, routes, workspaceRoot);
      case 'architecture':
      default: return this.buildArchitectureMap(parsedFiles, routes, workspaceRoot);
    }
  }

  private buildDependencyGraph(
    parsedFiles: ParsedFile[],
    root: string,
  ): { nodes: CyNodeData[]; edges: CyEdgeData[] } {
    const nodes: CyNodeData[] = [];
    const edges: CyEdgeData[] = [];
    const directories = new Set<string>();

    for (const file of parsedFiles) {
      const relPath = path.relative(root, file.filePath);
      const dir = path.dirname(relPath);
      if (dir !== '.') {
        this.addDirectoryChain(dir, directories);
      }

      nodes.push({
        data: {
          id: file.filePath,
          label: path.basename(file.filePath),
          type: this.inferFileType(file),
          filePath: file.filePath,
          parent: dir !== '.' ? this.dirId(dir) : undefined,
          symbolCount: file.symbols.length,
          importCount: file.imports.length,
        },
      });
    }

    for (const dir of directories) {
      const parentDir = path.dirname(dir);
      nodes.push({
        data: {
          id: this.dirId(dir),
          label: path.basename(dir),
          type: 'module',
          filePath: path.join(root, dir),
          parent: parentDir !== '.' && directories.has(parentDir)
            ? this.dirId(parentDir)
            : undefined,
        },
      });
    }

    for (const file of parsedFiles) {
      for (const imp of file.imports) {
        const targetPath = this.resolveImportPath(file.filePath, imp.source, root);
        if (targetPath && this.fileMap.has(targetPath)) {
          const edgeId = `${file.filePath}->${targetPath}`;
          edges.push({
            data: {
              id: edgeId,
              source: file.filePath,
              target: targetPath,
              type: 'import',
              label: imp.specifiers.length <= 3
                ? imp.specifiers.join(', ')
                : `${imp.specifiers.length} imports`,
            },
          });
        }
      }
    }

    return { nodes, edges };
  }

  private buildCallGraph(
    parsedFiles: ParsedFile[],
    root: string,
  ): { nodes: CyNodeData[]; edges: CyEdgeData[] } {
    const nodes: CyNodeData[] = [];
    const edges: CyEdgeData[] = [];
    const symbolLookup = this.buildSymbolLookup(parsedFiles);

    for (const file of parsedFiles) {
      for (const sym of file.symbols) {
        if (sym.type === 'function' || sym.type === 'component' || sym.type === 'class') {
          const nodeId = `${file.filePath}#${sym.name}`;
          nodes.push({
            data: {
              id: nodeId,
              label: sym.name,
              type: sym.type,
              filePath: file.filePath,
              line: sym.line,
              column: sym.column,
            },
          });

          if (sym.calls) {
            for (const callName of sym.calls) {
              const baseName = callName.includes('.') ? callName.split('.')[0] : callName;
              const targetId = symbolLookup.get(baseName);
              if (targetId) {
                edges.push({
                  data: {
                    id: `${nodeId}->call->${targetId}`,
                    source: nodeId,
                    target: targetId,
                    type: 'call',
                    label: callName,
                  },
                });
              }
            }
          }
        }
      }
    }

    return { nodes, edges };
  }

  private buildComponentTree(
    parsedFiles: ParsedFile[],
    root: string,
  ): { nodes: CyNodeData[]; edges: CyEdgeData[] } {
    const nodes: CyNodeData[] = [];
    const edges: CyEdgeData[] = [];
    const componentLookup = new Map<string, string>();

    for (const file of parsedFiles) {
      for (const sym of file.symbols) {
        if (sym.type === 'component') {
          const nodeId = `${file.filePath}#${sym.name}`;
          componentLookup.set(sym.name, nodeId);
          nodes.push({
            data: {
              id: nodeId,
              label: sym.name,
              type: 'component',
              filePath: file.filePath,
              line: sym.line,
              column: sym.column,
            },
          });
        }
      }
    }

    for (const file of parsedFiles) {
      for (const sym of file.symbols) {
        if (sym.type === 'component' && sym.jsxElements) {
          const sourceId = `${file.filePath}#${sym.name}`;
          for (const jsx of sym.jsxElements) {
            const targetId = componentLookup.get(jsx);
            if (targetId) {
              edges.push({
                data: {
                  id: `${sourceId}->render->${targetId}`,
                  source: sourceId,
                  target: targetId,
                  type: 'render',
                  label: 'renders',
                },
              });
            }
          }
        }
      }
    }

    return { nodes, edges };
  }

  private buildRouteMap(
    parsedFiles: ParsedFile[],
    routes: ParsedRoute[],
    root: string,
  ): { nodes: CyNodeData[]; edges: CyEdgeData[] } {
    const nodes: CyNodeData[] = [];
    const edges: CyEdgeData[] = [];

    for (const route of routes) {
      const routeId = `route:${route.path}:${route.method || 'GET'}`;
      const label = route.method
        ? `${route.method} ${route.path}`
        : route.path;

      nodes.push({
        data: {
          id: routeId,
          label,
          type: 'route',
          filePath: route.filePath,
          line: route.line,
        },
      });

      if (route.handler || route.component) {
        const targetName = route.handler || route.component!;
        for (const file of parsedFiles) {
          for (const sym of file.symbols) {
            if (sym.name === targetName) {
              const symId = `${file.filePath}#${sym.name}`;
              if (!nodes.some(n => n.data.id === symId)) {
                nodes.push({
                  data: {
                    id: symId,
                    label: sym.name,
                    type: sym.type,
                    filePath: file.filePath,
                    line: sym.line,
                    column: sym.column,
                  },
                });
              }
              edges.push({
                data: {
                  id: `${routeId}->${symId}`,
                  source: routeId,
                  target: symId,
                  type: 'route',
                  label: 'handled by',
                },
              });
            }
          }
        }
      }
    }

    return { nodes, edges };
  }

  private buildArchitectureMap(
    parsedFiles: ParsedFile[],
    routes: ParsedRoute[],
    root: string,
  ): { nodes: CyNodeData[]; edges: CyEdgeData[] } {
    const dep = this.buildDependencyGraph(parsedFiles, root);
    const call = this.buildCallGraph(parsedFiles, root);
    const comp = this.buildComponentTree(parsedFiles, root);
    const rte = this.buildRouteMap(parsedFiles, routes, root);

    const nodeMap = new Map<string, CyNodeData>();
    const edgeMap = new Map<string, CyEdgeData>();

    for (const set of [dep, call, comp, rte]) {
      for (const n of set.nodes) { nodeMap.set(n.data.id, n); }
      for (const e of set.edges) { edgeMap.set(e.data.id, e); }
    }

    return {
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values()),
    };
  }

  private resolveImportPath(fromFile: string, importPath: string, root: string): string | null {
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null;
    }

    const dir = path.dirname(fromFile);
    const resolved = path.resolve(dir, importPath);
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];

    if (this.fileMap.has(resolved)) { return resolved; }

    for (const ext of extensions) {
      const withExt = resolved + ext;
      if (this.fileMap.has(withExt)) { return withExt; }
    }

    for (const ext of extensions) {
      const indexPath = path.join(resolved, `index${ext}`);
      if (this.fileMap.has(indexPath)) { return indexPath; }
    }

    return null;
  }

  private inferFileType(file: ParsedFile): NodeType {
    const hasComponents = file.symbols.some(s => s.type === 'component');
    if (hasComponents) { return 'component'; }

    const hasClasses = file.symbols.some(s => s.type === 'class');
    if (hasClasses) { return 'class'; }

    return 'file';
  }

  private buildSymbolLookup(parsedFiles: ParsedFile[]): Map<string, string> {
    const lookup = new Map<string, string>();
    for (const file of parsedFiles) {
      for (const sym of file.symbols) {
        if (sym.exported && (sym.type === 'function' || sym.type === 'component' || sym.type === 'class')) {
          const id = `${file.filePath}#${sym.name}`;
          if (!lookup.has(sym.name)) {
            lookup.set(sym.name, id);
          }
        }
      }
    }
    return lookup;
  }

  private addDirectoryChain(dir: string, directories: Set<string>): void {
    const parts = dir.split(path.sep);
    for (let i = 1; i <= parts.length; i++) {
      directories.add(parts.slice(0, i).join(path.sep));
    }
  }

  private dirId(dir: string): string {
    return `dir:${dir}`;
  }
}
