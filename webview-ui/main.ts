import './styles/main.css';
import { GraphRenderer } from './graph/renderer';
import { setupInteractions } from './graph/interactions';
import { Controls } from './ui/controls';
import { Search } from './ui/search';
import { Filters } from './ui/filters';
import { Minimap } from './ui/minimap';
import { InsightsPanel } from './ui/insightsPanel';
import { FileDepsPanel } from './ui/fileDepsPanel';
import { Exporter } from './export/exporter';
import type { ToWebviewMessage, Insight, ViewType, FileDeps, WorkspaceFolderInfo } from '../src/types';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

const graphContainer = document.getElementById('graph-container')!;
const minimapContainer = document.getElementById('minimap')!;
const loadingEl = document.getElementById('loading')!;
const graphStatsEl = document.getElementById('graph-stats')!;
const legendEl = document.getElementById('legend')!;
const statsLegendDivider = document.getElementById('stats-legend-divider')!;

const folderSelector = document.getElementById('folder-selector') as HTMLSelectElement;

const TYPE_COLORS: Record<string, string> = {
  file: '#5B9BD5', class: '#E5C07B', function: '#C678DD', component: '#56B6C2',
  route: '#E06C75', module: '#3D5A80', interface: '#98C379', enum: '#D19A66', variable: '#61AFEF',
  k8sResource: '#326CE5', argoResource: '#EF7B4D', helmChart: '#0F1689', namespace: '#6B7280',
};

const TYPE_SINGULAR: Record<string, string> = {
  file: 'file', class: 'class', function: 'fn', component: 'component',
  route: 'route', module: 'module', interface: 'interface', enum: 'enum', variable: 'var',
  k8sResource: 'k8s', argoResource: 'argo', helmChart: 'helm', namespace: 'ns',
};

const TYPE_PLURAL: Record<string, string> = {
  file: 'files', class: 'classes', function: 'fns', component: 'components',
  route: 'routes', module: 'modules', interface: 'interfaces', enum: 'enums', variable: 'vars',
  k8sResource: 'k8s', argoResource: 'argo', helmChart: 'helm', namespace: 'ns',
};

const TYPE_DISPLAY_LABELS: Record<string, string> = {
  file: 'File', class: 'Class', function: 'Function', component: 'Component',
  route: 'Route', module: 'Module', interface: 'Interface', enum: 'Enum', variable: 'Variable',
  k8sResource: 'K8s', argoResource: 'Argo', helmChart: 'Helm', namespace: 'Namespace',
};

const renderer = new GraphRenderer(graphContainer);
const minimap = new Minimap(minimapContainer, renderer);
const controls = new Controls(renderer, vscode);
const search = new Search(renderer);
const filters = new Filters(renderer, vscode);
const insightsPanel = new InsightsPanel(renderer, vscode);
const fileDepsPanel = new FileDepsPanel(renderer, vscode);
const exporter = new Exporter(renderer, vscode);

setupInteractions(renderer, vscode, fileDepsPanel);

folderSelector.addEventListener('change', () => {
  vscode.postMessage({ command: 'changeWorkspaceFolder', uri: folderSelector.value });
});

let pendingFocusFile: string | null = null;

function updateBottomBar(): void {
  const cy = renderer.getCy();
  const edgeCount = cy.edges().length;

  const typeCounts = new Map<string, number>();
  cy.nodes().forEach(node => {
    const t = node.data('type') as string;
    if (!t) { return; }
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  });

  let totalNodes = 0;
  for (const c of typeCounts.values()) { totalNodes += c; }

  graphStatsEl.innerHTML = '';

  const addStat = (text: string, isFirst: boolean) => {
    if (!isFirst) {
      const sep = document.createElement('span');
      sep.className = 'stats-sep';
      sep.textContent = '\u00B7';
      graphStatsEl.appendChild(sep);
    }
    const span = document.createElement('span');
    span.className = 'stats';
    span.textContent = text;
    graphStatsEl.appendChild(span);
  };

  addStat(`${totalNodes} nodes`, true);
  addStat(`${edgeCount} edges`, false);

  const sortedTypes = Array.from(typeCounts.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  for (const [type, count] of sortedTypes) {
    const label = count === 1
      ? (TYPE_SINGULAR[type] || type)
      : (TYPE_PLURAL[type] || type);
    addStat(`${count} ${label}`, false);
  }

  legendEl.innerHTML = '';

  if (sortedTypes.length > 0) {
    statsLegendDivider.style.display = '';
    for (const [type] of sortedTypes) {
      const item = document.createElement('div');
      item.className = 'legend-item';

      const dot = document.createElement('span');
      dot.className = 'legend-dot';
      dot.style.background = TYPE_COLORS[type] || '#888';

      const label = document.createTextNode(TYPE_DISPLAY_LABELS[type] || type);

      item.appendChild(dot);
      item.appendChild(label);
      legendEl.appendChild(item);
    }
  } else {
    statsLegendDivider.style.display = 'none';
  }
}

function tryFocusFile(filePath: string): void {
  const cy = renderer.getCy();
  const matchedNode = cy.nodes().filter(n => n.data('filePath') === filePath);
  if (matchedNode.length > 0) {
    renderer.centerOnNode(matchedNode[0].id());
  }
}

window.addEventListener('message', (event: MessageEvent<ToWebviewMessage>) => {
  const message = event.data;

  switch (message.command) {
    case 'setGraph':
      renderer.setData(message.data.nodes, message.data.edges);
      minimap.update();
      filters.refresh();
      updateBottomBar();
      if (pendingFocusFile) {
        const fp = pendingFocusFile;
        pendingFocusFile = null;
        setTimeout(() => tryFocusFile(fp), 1200);
      }
      break;

    case 'setInsights':
      insightsPanel.setInsights(message.data as Insight[]);
      break;

    case 'setView':
      controls.setActiveView(message.view as ViewType);
      break;

    case 'setLoading':
      loadingEl.classList.toggle('hidden', !message.loading);
      break;

    case 'highlight':
      renderer.highlightNodes(message.nodeIds as string[]);
      break;

    case 'focusFile': {
      const filePath = (message as { command: 'focusFile'; filePath: string }).filePath;
      const cy = renderer.getCy();
      const matchedNode = cy.nodes().filter(n => n.data('filePath') === filePath);
      if (matchedNode.length > 0) {
        setTimeout(() => tryFocusFile(filePath), 1200);
      } else {
        pendingFocusFile = filePath;
      }
      break;
    }

    case 'setFileDeps':
      fileDepsPanel.setFileDeps((message as { command: 'setFileDeps'; data: FileDeps }).data);
      break;

    case 'setWorkspaceFolders': {
      const msg = message as { command: 'setWorkspaceFolders'; folders: WorkspaceFolderInfo[]; selected: string };
      folderSelector.innerHTML = '';
      for (const f of msg.folders) {
        const opt = document.createElement('option');
        opt.value = f.uri;
        opt.textContent = f.name;
        if (f.uri === msg.selected) { opt.selected = true; }
        folderSelector.appendChild(opt);
      }
      break;
    }
  }
});

vscode.postMessage({ command: 'ready' });
