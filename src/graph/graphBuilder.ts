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
      case 'userFlow': return this.buildUserFlow(parsedFiles, routes, workspaceRoot);
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

    if (nodes.length === 0) {
      return this.buildEntryPointMap(parsedFiles, root);
    }

    return { nodes, edges };
  }

  private buildEntryPointMap(
    parsedFiles: ParsedFile[],
    root: string,
  ): { nodes: CyNodeData[]; edges: CyEdgeData[] } {
    const nodes: CyNodeData[] = [];
    const edges: CyEdgeData[] = [];
    const addedNodes = new Set<string>();

    const importedFiles = new Set<string>();
    for (const file of parsedFiles) {
      for (const imp of file.imports) {
        const resolved = this.resolveImportPath(file.filePath, imp.source, root);
        if (resolved) { importedFiles.add(resolved); }
      }
    }

    const entryFiles = parsedFiles.filter(f =>
      !importedFiles.has(f.filePath) ||
      path.basename(f.filePath).match(/^(index|main|app|server)\./i),
    );

    const addNode = (filePath: string) => {
      if (addedNodes.has(filePath)) { return; }
      addedNodes.add(filePath);
      const file = this.fileMap.get(filePath);
      nodes.push({
        data: {
          id: filePath,
          label: path.basename(filePath),
          type: file ? this.inferFileType(file) : 'file',
          filePath,
        },
      });
    };

    for (const entry of entryFiles) {
      addNode(entry.filePath);
      for (const imp of entry.imports) {
        const resolved = this.resolveImportPath(entry.filePath, imp.source, root);
        if (!resolved || !this.fileMap.has(resolved)) { continue; }
        addNode(resolved);
        edges.push({
          data: {
            id: `${entry.filePath}->${resolved}`,
            source: entry.filePath,
            target: resolved,
            type: 'import',
            label: imp.specifiers.length <= 3
              ? imp.specifiers.join(', ')
              : `${imp.specifiers.length} imports`,
          },
        });
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

  private buildUserFlow(
    parsedFiles: ParsedFile[],
    routes: ParsedRoute[],
    root: string,
  ): { nodes: CyNodeData[]; edges: CyEdgeData[] } {
    const nodes: CyNodeData[] = [];
    const edges: CyEdgeData[] = [];
    const addedNodes = new Set<string>();
    const addedEdges = new Set<string>();

    const addNode = (id: string, data: CyNodeData['data']) => {
      if (addedNodes.has(id)) { return; }
      addedNodes.add(id);
      nodes.push({ data });
    };

    const addEdge = (id: string, data: CyEdgeData['data']) => {
      if (addedEdges.has(id)) { return; }
      addedEdges.add(id);
      edges.push({ data });
    };

    // Layer 0: Routes as entry points
    for (const route of routes) {
      const routeId = `route:${route.path}:${route.method || 'GET'}`;
      const label = route.method ? `${route.method} ${route.path}` : route.path;

      addNode(routeId, {
        id: routeId,
        label,
        type: 'route',
        filePath: route.filePath,
        line: route.line,
      });

      // Connect route to its handler file
      addNode(route.filePath, {
        id: route.filePath,
        label: path.basename(route.filePath),
        type: this.inferFileType(this.fileMap.get(route.filePath)!),
        filePath: route.filePath,
      });
      addEdge(`${routeId}->${route.filePath}`, {
        id: `${routeId}->${route.filePath}`,
        source: routeId,
        target: route.filePath,
        type: 'route',
        label: 'handles',
      });
    }

    // If no routes, find natural entry points: files not imported by any other analyzed file
    if (routes.length === 0) {
      const importedFiles = new Set<string>();
      for (const file of parsedFiles) {
        for (const imp of file.imports) {
          const resolved = this.resolveImportPath(file.filePath, imp.source, root);
          if (resolved) { importedFiles.add(resolved); }
        }
      }
      const entryFiles = parsedFiles.filter(f =>
        !importedFiles.has(f.filePath) ||
        path.basename(f.filePath).startsWith('index.'),
      );
      for (const file of entryFiles) {
        addNode(file.filePath, {
          id: file.filePath,
          label: path.basename(file.filePath),
          type: this.inferFileType(file),
          filePath: file.filePath,
        });
      }
    }

    // BFS through import chains (max 6 levels deep)
    const visited = new Set<string>();
    const queue: { filePath: string; depth: number }[] = [];

    for (const n of nodes) {
      if (n.data.type !== 'route') {
        queue.push({ filePath: n.data.filePath, depth: 0 });
      }
    }

    while (queue.length > 0) {
      const { filePath, depth } = queue.shift()!;
      if (visited.has(filePath) || depth > 6) { continue; }
      visited.add(filePath);

      const file = this.fileMap.get(filePath);
      if (!file) { continue; }

      for (const imp of file.imports) {
        const resolved = this.resolveImportPath(filePath, imp.source, root);
        if (!resolved || !this.fileMap.has(resolved)) { continue; }

        addNode(resolved, {
          id: resolved,
          label: path.basename(resolved),
          type: this.inferFileType(this.fileMap.get(resolved)!),
          filePath: resolved,
        });

        const edgeLabel = imp.specifiers.length <= 3
          ? imp.specifiers.join(', ')
          : `${imp.specifiers.length} imports`;

        addEdge(`${filePath}->${resolved}`, {
          id: `${filePath}->${resolved}`,
          source: filePath,
          target: resolved,
          type: 'import',
          label: edgeLabel,
        });

        queue.push({ filePath: resolved, depth: depth + 1 });
      }
    }

    return { nodes, edges };
  }

  buildFileGraph(
    parsedFiles: ParsedFile[],
    targetFilePath: string,
    root: string,
  ): { nodes: CyNodeData[]; edges: CyEdgeData[] } {
    this.ensureFileMap(parsedFiles);
    const nodes: CyNodeData[] = [];
    const edges: CyEdgeData[] = [];
    const addedNodes = new Set<string>();

    const targetFile = this.fileMap.get(targetFilePath);
    if (!targetFile) { return { nodes, edges }; }

    // Center node: the target file
    addedNodes.add(targetFilePath);
    nodes.push({
      data: {
        id: targetFilePath,
        label: path.basename(targetFilePath),
        type: this.inferFileType(targetFile),
        filePath: targetFilePath,
      },
    });

    // Files this file imports (outgoing)
    for (const imp of targetFile.imports) {
      const resolved = this.resolveImportPath(targetFilePath, imp.source, root);
      if (!resolved || !this.fileMap.has(resolved)) { continue; }

      if (!addedNodes.has(resolved)) {
        addedNodes.add(resolved);
        nodes.push({
          data: {
            id: resolved,
            label: path.basename(resolved),
            type: this.inferFileType(this.fileMap.get(resolved)!),
            filePath: resolved,
          },
        });
      }
      edges.push({
        data: {
          id: `${targetFilePath}->${resolved}`,
          source: targetFilePath,
          target: resolved,
          type: 'import',
          label: imp.specifiers.length <= 3
            ? imp.specifiers.join(', ')
            : `${imp.specifiers.length} imports`,
        },
      });
    }

    // Files that import this file (incoming)
    for (const file of parsedFiles) {
      if (file.filePath === targetFilePath) { continue; }
      for (const imp of file.imports) {
        const resolved = this.resolveImportPath(file.filePath, imp.source, root);
        if (resolved !== targetFilePath) { continue; }

        if (!addedNodes.has(file.filePath)) {
          addedNodes.add(file.filePath);
          nodes.push({
            data: {
              id: file.filePath,
              label: path.basename(file.filePath),
              type: this.inferFileType(file),
              filePath: file.filePath,
            },
          });
        }
        edges.push({
          data: {
            id: `${file.filePath}->${targetFilePath}`,
            source: file.filePath,
            target: targetFilePath,
            type: 'import',
            label: imp.specifiers.length <= 3
              ? imp.specifiers.join(', ')
              : `${imp.specifiers.length} imports`,
          },
        });
      }
    }

    return { nodes, edges };
  }

  buildFileCalls(
    parsedFiles: ParsedFile[],
    targetFilePath: string,
    root: string,
  ): { nodes: CyNodeData[]; edges: CyEdgeData[] } {
    this.ensureFileMap(parsedFiles);

    const nodes: CyNodeData[] = [];
    const edges: CyEdgeData[] = [];
    const addedNodes = new Set<string>();
    const symbolLookup = this.buildSymbolLookup(parsedFiles);

    const targetFile = this.fileMap.get(targetFilePath);
    if (!targetFile) { return { nodes, edges }; }

    for (const sym of targetFile.symbols) {
      if (sym.type !== 'function' && sym.type !== 'component' && sym.type !== 'class') { continue; }

      const sourceId = `${targetFilePath}#${sym.name}`;
      if (!addedNodes.has(sourceId)) {
        addedNodes.add(sourceId);
        nodes.push({
          data: {
            id: sourceId,
            label: sym.name,
            type: sym.type,
            filePath: targetFilePath,
            line: sym.line,
            column: sym.column,
          },
        });
      }

      if (sym.calls) {
        for (const callName of sym.calls) {
          const baseName = callName.includes('.') ? callName.split('.')[0] : callName;
          const targetId = symbolLookup.get(baseName);
          if (!targetId) { continue; }

          if (!addedNodes.has(targetId)) {
            addedNodes.add(targetId);
            const [fp, name] = targetId.split('#');
            const calledFile = this.fileMap.get(fp);
            const calledSym = calledFile?.symbols.find(s => s.name === name);
            nodes.push({
              data: {
                id: targetId,
                label: name,
                type: calledSym?.type || 'function',
                filePath: fp,
                line: calledSym?.line,
                column: calledSym?.column,
              },
            });
          }

          edges.push({
            data: {
              id: `${sourceId}->call->${targetId}`,
              source: sourceId,
              target: targetId,
              type: 'call',
              label: callName,
            },
          });
        }
      }
    }

    return { nodes, edges };
  }

  buildFileImporters(
    parsedFiles: ParsedFile[],
    targetFilePath: string,
    root: string,
  ): { nodes: CyNodeData[]; edges: CyEdgeData[] } {
    this.ensureFileMap(parsedFiles);

    const nodes: CyNodeData[] = [];
    const edges: CyEdgeData[] = [];
    const addedNodes = new Set<string>();
    const addedEdges = new Set<string>();

    const addNode = (filePath: string) => {
      if (addedNodes.has(filePath)) { return; }
      addedNodes.add(filePath);
      const file = this.fileMap.get(filePath);
      nodes.push({
        data: {
          id: filePath,
          label: path.basename(filePath),
          type: file ? this.inferFileType(file) : 'file',
          filePath,
        },
      });
    };

    addNode(targetFilePath);

    const visited = new Set<string>();
    const queue: { filePath: string; depth: number }[] = [{ filePath: targetFilePath, depth: 0 }];

    while (queue.length > 0) {
      const { filePath, depth } = queue.shift()!;
      if (visited.has(filePath) || depth > 3) { continue; }
      visited.add(filePath);

      for (const file of parsedFiles) {
        if (file.filePath === filePath) { continue; }
        for (const imp of file.imports) {
          const resolved = this.resolveImportPath(file.filePath, imp.source, root);
          if (resolved !== filePath) { continue; }

          addNode(file.filePath);

          const edgeId = `${file.filePath}->${filePath}`;
          if (!addedEdges.has(edgeId)) {
            addedEdges.add(edgeId);
            edges.push({
              data: {
                id: edgeId,
                source: file.filePath,
                target: filePath,
                type: 'import',
                label: imp.specifiers.length <= 3
                  ? imp.specifiers.join(', ')
                  : `${imp.specifiers.length} imports`,
              },
            });
          }

          queue.push({ filePath: file.filePath, depth: depth + 1 });
        }
      }
    }

    return { nodes, edges };
  }

  private ensureFileMap(parsedFiles: ParsedFile[]): void {
    this.fileMap.clear();
    for (const file of parsedFiles) {
      this.fileMap.set(file.filePath, file);
    }
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
