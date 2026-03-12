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
import type { ToWebviewMessage, Insight, ViewType, FileDeps } from '../src/types';

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
const nodeCountEl = document.getElementById('node-count')!;
const edgeCountEl = document.getElementById('edge-count')!;

const renderer = new GraphRenderer(graphContainer);
const minimap = new Minimap(minimapContainer, renderer);
const controls = new Controls(renderer, vscode);
const search = new Search(renderer);
const filters = new Filters(renderer, vscode);
const insightsPanel = new InsightsPanel(renderer, vscode);
const fileDepsPanel = new FileDepsPanel(renderer, vscode);
const exporter = new Exporter(renderer, vscode);

setupInteractions(renderer, vscode, fileDepsPanel);

function updateCounts(): void {
  const cy = renderer.getCy();
  const nodeCount = cy.nodes().length;
  const edgeCount = cy.edges().length;
  nodeCountEl.textContent = `${nodeCount} nodes`;
  edgeCountEl.textContent = `${edgeCount} edges`;
}

window.addEventListener('message', (event: MessageEvent<ToWebviewMessage>) => {
  const message = event.data;

  switch (message.command) {
    case 'setGraph':
      renderer.setData(message.data.nodes, message.data.edges);
      minimap.update();
      filters.refresh();
      updateCounts();
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
        renderer.focusOnNode(matchedNode[0].id());
      }
      break;
    }

    case 'setFileDeps':
      fileDepsPanel.setFileDeps((message as { command: 'setFileDeps'; data: FileDeps }).data);
      break;
  }
});

vscode.postMessage({ command: 'ready' });
