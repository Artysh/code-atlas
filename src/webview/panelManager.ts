import * as vscode from 'vscode';
import { ToWebviewMessage, ToExtensionMessage, ViewType, CyNodeData, CyEdgeData, Insight, FileDeps } from '../types';
import { getWebviewContent } from './contentProvider';

export class PanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly extensionUri: vscode.Uri;
  private _webviewReady = false;
  private _messageQueue: ToWebviewMessage[] = [];
  private _readyResolvers: (() => void)[] = [];

  /**
   * When true, the panel is displaying a file-specific view
   * (file graph, file calls, file importers) and should NOT
   * be overwritten by a full refresh triggered by changeView.
   */
  private _fileViewActive = false;

  private readonly _onDidRequestRefresh = new vscode.EventEmitter<void>();
  private readonly _onDidChangeView = new vscode.EventEmitter<ViewType>();
  private readonly _onDidRequestFileDeps = new vscode.EventEmitter<string>();
  private readonly _onDidRequestFileCalls = new vscode.EventEmitter<string>();
  private readonly _onDidRequestFileImporters = new vscode.EventEmitter<string>();
  readonly onDidRequestRefresh = this._onDidRequestRefresh.event;
  readonly onDidChangeView = this._onDidChangeView.event;
  readonly onDidRequestFileDeps = this._onDidRequestFileDeps.event;
  readonly onDidRequestFileCalls = this._onDidRequestFileCalls.event;
  readonly onDidRequestFileImporters = this._onDidRequestFileImporters.event;

  constructor(private context: vscode.ExtensionContext) {
    this.extensionUri = context.extensionUri;
  }

  get isFileViewActive(): boolean {
    return this._fileViewActive;
  }

  setFileViewActive(active: boolean): void {
    this._fileViewActive = active;
  }

  show(viewType: ViewType = 'architecture'): void {
    if (this.panel) {
      this.panel.reveal();
      this.postMessage({ command: 'setView', view: viewType });
      return;
    }

    this._webviewReady = false;
    this._messageQueue = [];

    this.panel = vscode.window.createWebviewPanel(
      'codeAtlas',
      'Code Atlas',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')],
      },
    );

    this.panel.webview.html = getWebviewContent(this.panel.webview, this.extensionUri);

    this.panel.webview.onDidReceiveMessage(
      (message: ToExtensionMessage) => this.handleMessage(message),
      undefined,
      this.context.subscriptions,
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this._webviewReady = false;
      this._messageQueue = [];
      this._fileViewActive = false;
      for (const resolver of this._readyResolvers) { resolver(); }
      this._readyResolvers = [];
    }, null, this.context.subscriptions);

    this._messageQueue.push({ command: 'setView', view: viewType });
  }

  sendGraph(nodes: CyNodeData[], edges: CyEdgeData[]): void {
    this.postMessage({ command: 'setGraph', data: { nodes, edges } });
  }

  sendInsights(insights: Insight[]): void {
    this.postMessage({ command: 'setInsights', data: insights });
  }

  sendLoading(loading: boolean): void {
    this.postMessage({ command: 'setLoading', loading });
  }

  highlightNodes(nodeIds: string[]): void {
    this.postMessage({ command: 'highlight', nodeIds });
  }

  focusFile(filePath: string): void {
    this.postMessage({ command: 'focusFile', filePath });
  }

  sendFileDeps(deps: FileDeps): void {
    this.postMessage({ command: 'setFileDeps', data: deps });
  }

  waitForReady(): Promise<void> {
    if (this._webviewReady) { return Promise.resolve(); }
    return new Promise<void>((resolve) => {
      this._readyResolvers.push(resolve);
      setTimeout(() => {
        const idx = this._readyResolvers.indexOf(resolve);
        if (idx !== -1) {
          this._readyResolvers.splice(idx, 1);
          resolve();
        }
      }, 8000);
    });
  }

  get isVisible(): boolean {
    return this.panel?.visible ?? false;
  }

  private postMessage(message: ToWebviewMessage): void {
    if (!this.panel) { return; }

    if (this._webviewReady) {
      this.panel.webview.postMessage(message);
    } else {
      this._messageQueue.push(message);
    }
  }

  private flushMessageQueue(): void {
    if (!this.panel) { return; }
    for (const msg of this._messageQueue) {
      this.panel.webview.postMessage(msg);
    }
    this._messageQueue = [];
  }

  private async handleMessage(message: ToExtensionMessage): Promise<void> {
    switch (message.command) {
      case 'openFile': {
        try {
          const uri = vscode.Uri.file(message.filePath);
          const doc = await vscode.workspace.openTextDocument(uri);
          const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
          if (message.line) {
            const pos = new vscode.Position(
              message.line - 1,
              (message.column || 1) - 1,
            );
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(
              new vscode.Range(pos, pos),
              vscode.TextEditorRevealType.InCenter,
            );
          }
        } catch (err) {
          vscode.window.showErrorMessage(`Could not open file: ${message.filePath}`);
        }
        break;
      }

      case 'requestRefresh':
        this._fileViewActive = false;
        this._onDidRequestRefresh.fire();
        break;

      case 'changeView':
        if (this._fileViewActive) {
          this._fileViewActive = false;
        }
        this._onDidChangeView.fire(message.view);
        break;

      case 'getFileDeps':
        this._onDidRequestFileDeps.fire(message.filePath);
        break;

      case 'showFileCalls':
        this._onDidRequestFileCalls.fire(message.filePath);
        break;

      case 'showFileImporters':
        this._onDidRequestFileImporters.fire(message.filePath);
        break;

      case 'saveExport': {
        const filterMap: Record<string, Record<string, string[]>> = {
          png: { 'PNG Image': ['png'] },
          svg: { 'SVG Image': ['svg'] },
          json: { 'JSON File': ['json'] },
          drawio: { 'Draw.io Diagram': ['drawio'] },
        };
        const ext = message.format === 'drawio' ? 'drawio' : message.format;
        const uri = await vscode.window.showSaveDialog({
          filters: filterMap[message.format],
          defaultUri: vscode.Uri.file(`code-atlas-export.${ext}`),
        });
        if (uri) {
          const content = message.format === 'png'
            ? Buffer.from(message.data, 'base64')
            : Buffer.from(message.data, 'utf-8');
          await vscode.workspace.fs.writeFile(uri, content);
          vscode.window.showInformationMessage(`Exported to ${uri.fsPath}`);
        }
        break;
      }

      case 'ready':
        this._webviewReady = true;
        this.flushMessageQueue();
        for (const resolver of this._readyResolvers) { resolver(); }
        this._readyResolvers = [];
        break;
    }
  }

  dispose(): void {
    this.panel?.dispose();
    this._onDidRequestRefresh.dispose();
    this._onDidChangeView.dispose();
    this._onDidRequestFileDeps.dispose();
    this._onDidRequestFileCalls.dispose();
    this._onDidRequestFileImporters.dispose();
  }
}
