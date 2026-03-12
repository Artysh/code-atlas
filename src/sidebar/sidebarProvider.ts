import * as vscode from 'vscode';

interface SidebarEntry {
  label: string;
  command: string;
  icon: string;
  description?: string;
}

const QUICK_ACTIONS: SidebarEntry[] = [
  { label: 'Open Architecture Map', command: 'code-atlas.showGraph', icon: 'type-hierarchy', description: 'Full overview' },
  { label: 'Refresh Analysis', command: 'code-atlas.refresh', icon: 'refresh', description: 'Re-scan workspace' },
  { label: 'Export Graph', command: 'code-atlas.exportGraph', icon: 'export', description: 'PNG / SVG / JSON' },
];

const FILE_ACTIONS: SidebarEntry[] = [
  { label: 'Show Active File in Graph', command: 'code-atlas.showFileInGraph', icon: 'search', description: 'File connections' },
  { label: 'Show File Dependencies', command: 'code-atlas.showFileGraph', icon: 'references', description: 'Import graph' },
  { label: 'Show Called Functions', command: 'code-atlas.showFileCalls', icon: 'call-outgoing', description: 'Call graph' },
  { label: 'Show Reverse Dependencies', command: 'code-atlas.showFileImporters', icon: 'call-incoming', description: 'Who imports' },
];

const HELP_ITEMS: SidebarEntry[] = [
  { label: 'Keyboard: Arrow keys to pan', command: '', icon: 'info' },
  { label: 'Keyboard: +/- to zoom', command: '', icon: 'info' },
  { label: 'Keyboard: 0 to fit view', command: '', icon: 'info' },
  { label: 'Double-click node to focus', command: '', icon: 'info' },
  { label: 'Right-click node for options', command: '', icon: 'info' },
];

class SidebarItem extends vscode.TreeItem {
  constructor(entry: SidebarEntry, private isHeader: boolean = false) {
    super(
      entry.label,
      isHeader
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None,
    );

    if (!isHeader) {
      if (entry.command) {
        this.command = {
          command: entry.command,
          title: entry.label,
        };
      }
      this.iconPath = new vscode.ThemeIcon(entry.icon);
      if (entry.description) {
        this.description = entry.description;
      }
    } else {
      this.contextValue = 'header';
    }
  }
}

export class SidebarProvider implements vscode.TreeDataProvider<SidebarItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SidebarItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _stats: { files: number; nodes: number; edges: number } = { files: 0, nodes: 0, edges: 0 };

  getTreeItem(element: SidebarItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SidebarItem): SidebarItem[] {
    if (!element) {
      return [
        new SidebarItem({ label: 'Quick Actions', command: '', icon: '' }, true),
        new SidebarItem({ label: 'Active File', command: '', icon: '' }, true),
        new SidebarItem({ label: 'Tips', command: '', icon: '' }, true),
      ];
    }

    if (element.label === 'Quick Actions') {
      return QUICK_ACTIONS.map(e => new SidebarItem(e));
    }

    if (element.label === 'Active File') {
      return FILE_ACTIONS.map(e => new SidebarItem(e));
    }

    if (element.label === 'Tips') {
      return HELP_ITEMS.map(e => new SidebarItem(e));
    }

    return [];
  }

  updateStats(files: number, nodes: number, edges: number): void {
    this._stats = { files, nodes, edges };
    this._onDidChangeTreeData.fire(undefined);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}
