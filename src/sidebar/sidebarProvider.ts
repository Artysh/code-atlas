import * as vscode from 'vscode';

interface SidebarEntry {
  label: string;
  command: string;
  icon: string;
  description?: string;
}

const VIEW_ITEMS: SidebarEntry[] = [
  { label: 'Architecture Map', command: 'code-atlas.showGraph', icon: 'type-hierarchy', description: 'All relationships' },
  { label: 'Dependency Graph', command: 'code-atlas.showDependencyGraph', icon: 'references', description: 'File imports' },
  { label: 'Call Graph', command: 'code-atlas.showCallGraph', icon: 'call-outgoing', description: 'Function calls' },
  { label: 'Component Tree', command: 'code-atlas.showComponentTree', icon: 'symbol-class', description: 'React components' },
  { label: 'Route Map', command: 'code-atlas.showRouteMap', icon: 'globe', description: 'API routes' },
  { label: 'User Flow', command: 'code-atlas.showUserFlow', icon: 'git-merge', description: 'Service access paths' },
];

const ACTION_ITEMS: SidebarEntry[] = [
  { label: 'Refresh Analysis', command: 'code-atlas.refresh', icon: 'refresh' },
  { label: 'Export Graph', command: 'code-atlas.exportGraph', icon: 'export' },
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
      this.command = {
        command: entry.command,
        title: entry.label,
      };
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

  getTreeItem(element: SidebarItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SidebarItem): SidebarItem[] {
    if (!element) {
      return [
        new SidebarItem({ label: 'Views', command: '', icon: '' }, true),
        new SidebarItem({ label: 'Actions', command: '', icon: '' }, true),
      ];
    }

    if (element.label === 'Views') {
      return VIEW_ITEMS.map(e => new SidebarItem(e));
    }

    if (element.label === 'Actions') {
      return ACTION_ITEMS.map(e => new SidebarItem(e));
    }

    return [];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}
