import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Scanner } from './parsers/scanner';
import { AstParser } from './parsers/astParser';
import { RouteParser } from './parsers/routeParser';
import { GraphBuilder } from './graph/graphBuilder';
import { Analyzer } from './insights/analyzer';
import { CacheManager } from './cache/cacheManager';
import { PanelManager } from './webview/panelManager';
import { ViewType, ParsedFile, ParsedRoute, FileDeps } from './types';
import { SidebarProvider } from './sidebar/sidebarProvider';

let scanner: Scanner;
let astParser: AstParser;
let routeParser: RouteParser;
let graphBuilder: GraphBuilder;
let analyzer: Analyzer;
let cacheManager: CacheManager;
let panelManager: PanelManager;
let currentView: ViewType = 'architecture';
let refreshDebounce: ReturnType<typeof setTimeout> | undefined;

let lastParsedFiles: ParsedFile[] = [];
let lastRoutes: ParsedRoute[] = [];

let refreshInProgress = false;

export function activate(context: vscode.ExtensionContext): void {
  try {
    scanner = new Scanner();
    astParser = new AstParser();
    routeParser = new RouteParser();
    graphBuilder = new GraphBuilder();
    analyzer = new Analyzer();
    cacheManager = new CacheManager();
    panelManager = new PanelManager(context);

    cacheManager.startWatching();

    const sidebarProvider = new SidebarProvider();
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('codeAtlas.views', sidebarProvider),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('code-atlas.showGraph', () => showGraph('architecture')),
      vscode.commands.registerCommand('code-atlas.showDependencyGraph', () => showGraph('dependency')),
      vscode.commands.registerCommand('code-atlas.showCallGraph', () => showGraph('callGraph')),
      vscode.commands.registerCommand('code-atlas.showComponentTree', () => showGraph('componentTree')),
      vscode.commands.registerCommand('code-atlas.showRouteMap', () => showGraph('routeMap')),
      vscode.commands.registerCommand('code-atlas.showUserFlow', () => showGraph('userFlow')),
      vscode.commands.registerCommand('code-atlas.refresh', () => refresh()),
      vscode.commands.registerCommand('code-atlas.exportGraph', () => {
        panelManager.show(currentView);
      }),

      vscode.commands.registerCommand('code-atlas.showFileInGraph', async (uri?: vscode.Uri) => {
        const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.uri.fsPath;
        if (!filePath) {
          vscode.window.showWarningMessage('Code Atlas: No file selected.');
          return;
        }
        await showFileInGraph(filePath);
      }),

      vscode.commands.registerCommand('code-atlas.showFileGraph', async (uri?: vscode.Uri) => {
        const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.uri.fsPath;
        if (!filePath) { return; }
        await showFileGraph(filePath);
      }),

      vscode.commands.registerCommand('code-atlas.showFileCalls', async (uri?: vscode.Uri) => {
        const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.uri.fsPath;
        if (!filePath) { return; }
        await showFileCalls(filePath);
      }),

      vscode.commands.registerCommand('code-atlas.showFileImporters', async (uri?: vscode.Uri) => {
        const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.uri.fsPath;
        if (!filePath) { return; }
        await showFileImporters(filePath);
      }),
    );

    panelManager.onDidRequestRefresh(() => refresh());
    panelManager.onDidChangeView((view) => {
      currentView = view;
      refresh();
    });

    panelManager.onDidRequestFileDeps(async (filePath) => {
      await ensureParsedData();
      const deps = computeFileDeps(filePath);
      if (deps) { panelManager.sendFileDeps(deps); }
    });

    panelManager.onDidRequestFileCalls((filePath) => {
      showFileCalls(filePath);
    });

    panelManager.onDidRequestFileImporters((filePath) => {
      showFileImporters(filePath);
    });

    cacheManager.onDidInvalidate(() => {
      if (!panelManager.isVisible) { return; }
      if (panelManager.isFileViewActive) { return; }
      if (refreshDebounce) { clearTimeout(refreshDebounce); }
      refreshDebounce = setTimeout(() => refresh(), 1000);
    });

    context.subscriptions.push(cacheManager);
    context.subscriptions.push(panelManager);

    console.log('Code Atlas extension activated successfully');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Code Atlas activation failed:', msg);
    vscode.window.showErrorMessage(`Code Atlas failed to activate: ${msg}`);
  }
}

async function showGraph(view: ViewType): Promise<void> {
  currentView = view;
  panelManager.setFileViewActive(false);
  panelManager.show(view);
  await panelManager.waitForReady();
  await refresh();
}

async function showFileInGraph(filePath: string): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) { return; }

  await ensureParsedData();

  const viewToUse = currentView === 'architecture' ? 'architecture' : currentView;
  panelManager.setFileViewActive(false);
  panelManager.show(viewToUse);
  await panelManager.waitForReady();

  if (lastParsedFiles.length > 0) {
    const { nodes, edges } = graphBuilder.build(lastParsedFiles, lastRoutes, viewToUse, workspaceRoot);
    const insights = analyzer.analyze(lastParsedFiles, workspaceRoot);
    panelManager.sendGraph(nodes, edges);
    panelManager.sendInsights(insights);
  }

  panelManager.focusFile(filePath);
}

async function showFileGraph(filePath: string): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) { return; }

  await ensureParsedData();

  panelManager.setFileViewActive(true);
  panelManager.show('dependency');
  await panelManager.waitForReady();
  panelManager.sendLoading(true);

  try {
    const { nodes, edges } = graphBuilder.buildFileGraph(lastParsedFiles, filePath, workspaceRoot);
    if (nodes.length === 0) {
      vscode.window.showInformationMessage(`Code Atlas: No connections found for ${path.basename(filePath)}`);
    }
    panelManager.sendGraph(nodes, edges);
    panelManager.focusFile(filePath);

    const deps = computeFileDeps(filePath);
    if (deps) { panelManager.sendFileDeps(deps); }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Code Atlas: ${msg}`);
  } finally {
    panelManager.sendLoading(false);
  }
}

async function showFileCalls(filePath: string): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) { return; }

  await ensureParsedData();

  panelManager.setFileViewActive(true);
  panelManager.show('callGraph');
  await panelManager.waitForReady();
  panelManager.sendLoading(true);

  try {
    const { nodes, edges } = graphBuilder.buildFileCalls(lastParsedFiles, filePath, workspaceRoot);
    if (nodes.length === 0) {
      vscode.window.showInformationMessage(`Code Atlas: No callable symbols found in ${path.basename(filePath)}`);
    }
    panelManager.sendGraph(nodes, edges);

    const deps = computeFileDeps(filePath);
    if (deps) { panelManager.sendFileDeps(deps); }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Code Atlas: ${msg}`);
  } finally {
    panelManager.sendLoading(false);
  }
}

async function showFileImporters(filePath: string): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) { return; }

  await ensureParsedData();

  panelManager.setFileViewActive(true);
  panelManager.show('dependency');
  await panelManager.waitForReady();
  panelManager.sendLoading(true);

  try {
    const { nodes, edges } = graphBuilder.buildFileImporters(lastParsedFiles, filePath, workspaceRoot);
    if (nodes.length <= 1) {
      vscode.window.showInformationMessage(`Code Atlas: No files import ${path.basename(filePath)}`);
    }
    panelManager.sendGraph(nodes, edges);
    panelManager.focusFile(filePath);

    const deps = computeFileDeps(filePath);
    if (deps) { panelManager.sendFileDeps(deps); }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Code Atlas: ${msg}`);
  } finally {
    panelManager.sendLoading(false);
  }
}

async function ensureParsedData(): Promise<void> {
  if (lastParsedFiles.length > 0) { return; }

  const filePaths = await scanner.scan();
  lastParsedFiles = [];
  lastRoutes = [];

  for (const filePath of filePaths) {
    const content = fs.readFileSync(filePath, 'utf-8');

    let parsed = cacheManager.get(filePath);
    if (!parsed) {
      parsed = astParser.parseFile(filePath, content);
      cacheManager.set(filePath, parsed);
    }
    lastParsedFiles.push(parsed);

    const routes = routeParser.parseFile(filePath, content);
    lastRoutes.push(...routes);
  }
}

function computeFileDeps(targetPath: string): FileDeps | null {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot || lastParsedFiles.length === 0) { return null; }

  const targetFile = lastParsedFiles.find(f => f.filePath === targetPath);
  if (!targetFile) { return null; }

  const imports: FileDeps['imports'] = [];
  for (const imp of targetFile.imports) {
    if (!imp.source.startsWith('.') && !imp.source.startsWith('/')) { continue; }
    const dir = path.dirname(targetPath);
    const resolved = resolveImportForDeps(dir, imp.source, lastParsedFiles);
    if (resolved) {
      imports.push({
        filePath: resolved,
        fileName: path.basename(resolved),
        symbols: imp.specifiers,
      });
    }
  }

  const importedBy: FileDeps['importedBy'] = [];
  for (const file of lastParsedFiles) {
    if (file.filePath === targetPath) { continue; }
    for (const imp of file.imports) {
      if (!imp.source.startsWith('.') && !imp.source.startsWith('/')) { continue; }
      const dir = path.dirname(file.filePath);
      const resolved = resolveImportForDeps(dir, imp.source, lastParsedFiles);
      if (resolved === targetPath) {
        importedBy.push({
          filePath: file.filePath,
          fileName: path.basename(file.filePath),
          symbols: imp.specifiers,
        });
      }
    }
  }

  const symbols: FileDeps['symbols'] = targetFile.symbols
    .filter(s => s.type === 'function' || s.type === 'class' || s.type === 'component')
    .map(s => ({
      name: s.name,
      type: s.type,
      calls: s.calls || [],
    }));

  return {
    filePath: targetPath,
    fileName: path.basename(targetPath),
    imports,
    importedBy,
    symbols,
  };
}

function resolveImportForDeps(fromDir: string, importPath: string, parsedFiles: ParsedFile[]): string | null {
  const resolved = path.resolve(fromDir, importPath);
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  const knownPaths = new Set(parsedFiles.map(f => f.filePath));

  if (knownPaths.has(resolved)) { return resolved; }
  for (const ext of extensions) {
    if (knownPaths.has(resolved + ext)) { return resolved + ext; }
  }
  for (const ext of extensions) {
    const idx = path.join(resolved, `index${ext}`);
    if (knownPaths.has(idx)) { return idx; }
  }
  return null;
}

async function refresh(): Promise<void> {
  if (refreshInProgress) { return; }
  if (panelManager.isFileViewActive) { return; }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('Code Atlas: No workspace folder open.');
    return;
  }

  refreshInProgress = true;
  panelManager.sendLoading(true);

  try {
    const filePaths = await scanner.scan();
    lastParsedFiles = [];
    lastRoutes = [];

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Code Atlas: Analyzing codebase...',
        cancellable: false,
      },
      async (progress) => {
        for (let i = 0; i < filePaths.length; i++) {
          const filePath = filePaths[i];
          const content = fs.readFileSync(filePath, 'utf-8');

          let parsed = cacheManager.get(filePath);
          if (!parsed) {
            parsed = astParser.parseFile(filePath, content);
            cacheManager.set(filePath, parsed);
          }
          lastParsedFiles.push(parsed);

          const routes = routeParser.parseFile(filePath, content);
          lastRoutes.push(...routes);

          if (i % 50 === 0) {
            progress.report({
              message: `${i + 1}/${filePaths.length} files`,
              increment: (50 / filePaths.length) * 100,
            });
          }
        }
      },
    );

    const { nodes, edges } = graphBuilder.build(lastParsedFiles, lastRoutes, currentView, workspaceRoot);
    const insights = analyzer.analyze(lastParsedFiles, workspaceRoot);

    panelManager.sendGraph(nodes, edges);
    panelManager.sendInsights(insights);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Code Atlas: Analysis failed — ${msg}`);
  } finally {
    refreshInProgress = false;
    panelManager.sendLoading(false);
  }
}

export function deactivate(): void {
  cacheManager?.dispose();
  panelManager?.dispose();
}
