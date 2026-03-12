import * as vscode from 'vscode';
import { ToWebviewMessage, ToExtensionMessage, ViewType, CyNodeData, CyEdgeData, Insight, FileDeps } from '../types';
import { getWebviewContent } from './contentProvider';

export class PanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly extensionUri: vscode.Uri;

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

  show(viewType: ViewType = 'architecture'): void {
    if (this.panel) {
      this.panel.reveal();
      this.postMessage({ command: 'setView', view: viewType });
      return;
    }

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
    }, null, this.context.subscriptions);
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

  get isVisible(): boolean {
    return this.panel?.visible ?? false;
  }

  private postMessage(message: ToWebviewMessage): void {
    this.panel?.webview.postMessage(message);
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
        this._onDidRequestRefresh.fire();
        break;

      case 'changeView':
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
        };
        const uri = await vscode.window.showSaveDialog({
          filters: filterMap[message.format],
          defaultUri: vscode.Uri.file(`code-atlas-export.${message.format}`),
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
