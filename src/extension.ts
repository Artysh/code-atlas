import * as vscode from 'vscode';
import * as fs from 'fs';
import { Scanner } from './parsers/scanner';
import { AstParser } from './parsers/astParser';
import { RouteParser } from './parsers/routeParser';
import { GraphBuilder } from './graph/graphBuilder';
import { Analyzer } from './insights/analyzer';
import { CacheManager } from './cache/cacheManager';
import { PanelManager } from './webview/panelManager';
import { ViewType, ParsedFile, ParsedRoute } from './types';
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
      vscode.commands.registerCommand('code-atlas.refresh', () => refresh()),
      vscode.commands.registerCommand('code-atlas.exportGraph', () => {
        panelManager.show(currentView);
      }),
    );

    panelManager.onDidRequestRefresh(() => refresh());
    panelManager.onDidChangeView((view) => {
      currentView = view;
      refresh();
    });

    cacheManager.onDidInvalidate(() => {
      if (!panelManager.isVisible) { return; }
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
  panelManager.show(view);
  await refresh();
}

async function refresh(): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('Code Atlas: No workspace folder open.');
    return;
  }

  panelManager.sendLoading(true);

  try {
    const filePaths = await scanner.scan();
    const parsedFiles: ParsedFile[] = [];
    const allRoutes: ParsedRoute[] = [];

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Code Atlas: Analyzing codebase...',
        cancellable: false,
      },
      async (progress) => {
        for (let i = 0; i < filePaths.length; i++) {
          const filePath = filePaths[i];

          let parsed = cacheManager.get(filePath);
          if (!parsed) {
            const content = fs.readFileSync(filePath, 'utf-8');
            parsed = astParser.parseFile(filePath, content);
            cacheManager.set(filePath, parsed);

            const routes = routeParser.parseFile(filePath, content);
            allRoutes.push(...routes);
          }
          parsedFiles.push(parsed);

          if (i % 50 === 0) {
            progress.report({
              message: `${i + 1}/${filePaths.length} files`,
              increment: (50 / filePaths.length) * 100,
            });
          }
        }
      },
    );

    const { nodes, edges } = graphBuilder.build(parsedFiles, allRoutes, currentView, workspaceRoot);
    const insights = analyzer.analyze(parsedFiles, workspaceRoot);

    panelManager.sendGraph(nodes, edges);
    panelManager.sendInsights(insights);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Code Atlas: Analysis failed — ${msg}`);
  } finally {
    panelManager.sendLoading(false);
  }
}

export function deactivate(): void {
  cacheManager?.dispose();
  panelManager?.dispose();
}
