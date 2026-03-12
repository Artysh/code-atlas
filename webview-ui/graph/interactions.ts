import cytoscape from 'cytoscape';
import type { GraphRenderer } from './renderer';
import type { FileDepsPanel } from '../ui/fileDepsPanel';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

type MenuItem = { label: string; icon: string; action: () => void } | 'divider';

export function setupInteractions(renderer: GraphRenderer, vscode: VsCodeApi, fileDepsPanel: FileDepsPanel): void {
  const cy = renderer.getCy();
  const tooltip = document.getElementById('tooltip')!;
  const contextMenu = document.getElementById('context-menu')!;

  let focusModeNode: string | null = null;
  const PAN_STEP = 50;
  const PAN_STEP_FAST = 150;

  cy.on('tap', 'node', (event) => {
    const node = event.target;
    const filePath = node.data('filePath');
    if (!filePath) { return; }
    if (node.isParent()) { return; }

    vscode.postMessage({
      command: 'openFile',
      filePath,
      line: node.data('line'),
      column: node.data('column'),
    });

    vscode.postMessage({ command: 'getFileDeps', filePath });
  });

  cy.on('tap', (event) => {
    if (event.target === cy) {
      renderer.clearHighlight();
      focusModeNode = null;
      hideContextMenu();
    }
  });

  cy.on('dbltap', 'node', (event) => {
    const node = event.target;
    if (node.isParent()) { return; }

    const nodeId = node.id();
    if (focusModeNode === nodeId) {
      renderer.clearHighlight();
      focusModeNode = null;
    } else {
      renderer.focusOnNode(nodeId);
      focusModeNode = nodeId;
    }
  });

  cy.on('mouseover', 'node', (event) => {
    const node = event.target;
    if (node.isParent()) { return; }

    node.addClass('hover-glow');
    node.connectedEdges().forEach((e: cytoscape.EdgeSingular) => {
      e.style('opacity', 0.9);
      e.style('width', 3.5);
    });

    const type = node.data('type') || 'unknown';
    const label = node.data('label') || '';
    const filePath = node.data('filePath') || '';
    const line = node.data('line');

    let html = `<strong>${label}</strong><br>`;
    html += `<span class="tooltip-type">${type}</span><br>`;
    html += `<span class="tooltip-path">${filePath}</span>`;
    if (line) {
      html += `<span class="tooltip-line">:${line}</span>`;
    }

    const connectedEdges = node.connectedEdges();
    let incoming = 0;
    let outgoing = 0;
    connectedEdges.forEach((e: cytoscape.EdgeSingular) => {
      if (e.target().id() === node.id()) { incoming++; }
      if (e.source().id() === node.id()) { outgoing++; }
    });
    html += `<br><span class="tooltip-stats">${incoming} in / ${outgoing} out</span>`;

    tooltip.innerHTML = html;
    tooltip.classList.remove('hidden');

    const renderedPos = node.renderedPosition();
    const containerRect = cy.container()!.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = containerRect.left + renderedPos.x + 20;
    let top = containerRect.top + renderedPos.y - 10;

    if (left + tooltipRect.width > window.innerWidth) {
      left = containerRect.left + renderedPos.x - tooltipRect.width - 20;
    }
    if (top + tooltipRect.height > window.innerHeight) {
      top = window.innerHeight - tooltipRect.height - 10;
    }
    if (top < 0) { top = 10; }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  });

  cy.on('mouseout', 'node', (event) => {
    const node = event.target;
    node.removeClass('hover-glow');
    node.connectedEdges().forEach((e: cytoscape.EdgeSingular) => {
      e.removeStyle('opacity');
      e.removeStyle('width');
    });
    tooltip.classList.add('hidden');
  });

  cy.on('mouseover', 'edge', (event) => {
    const edge = event.target;
    edge.style('opacity', 1);
    edge.style('width', 4);
  });

  cy.on('mouseout', 'edge', (event) => {
    const edge = event.target;
    edge.removeStyle('opacity');
    edge.removeStyle('width');
  });

  cy.on('cxttap', 'node', (event) => {
    const node = event.target;
    if (node.isParent()) { return; }

    event.originalEvent?.preventDefault?.();

    const nodeId = node.id();
    const renderedPos = node.renderedPosition();
    const containerRect = cy.container()!.getBoundingClientRect();

    contextMenu.innerHTML = '';

    const menuItems: MenuItem[] = [
      { label: 'Open File', icon: '\u{1F4C4}', action: () => {
        vscode.postMessage({
          command: 'openFile',
          filePath: node.data('filePath'),
          line: node.data('line'),
        });
      }},
      'divider',
      { label: 'Show Dependencies', icon: '\u2192', action: () => {
        const depIds: string[] = [];
        node.outgoers().nodes().forEach((n: cytoscape.NodeSingular) => { depIds.push(n.id()); });
        renderer.highlightNodes([nodeId, ...depIds]);
      }},
      { label: 'Show Dependents', icon: '\u2190', action: () => {
        const depIds: string[] = [];
        node.incomers().nodes().forEach((n: cytoscape.NodeSingular) => { depIds.push(n.id()); });
        renderer.highlightNodes([nodeId, ...depIds]);
      }},
      { label: 'Show File Dependencies', icon: '\u{1F50D}', action: () => {
        vscode.postMessage({ command: 'getFileDeps', filePath: node.data('filePath') });
        const sidebar = document.getElementById('sidebar')!;
        sidebar.classList.remove('hidden');
        setTimeout(() => renderer.getCy().resize(), 100);
      }},
      { label: 'Show Called Functions', icon: '\u{26A1}', action: () => {
        vscode.postMessage({ command: 'showFileCalls', filePath: node.data('filePath') });
      }},
      { label: 'Show Who Imports This', icon: '\u{1F517}', action: () => {
        vscode.postMessage({ command: 'showFileImporters', filePath: node.data('filePath') });
      }},
      'divider',
      { label: 'Focus on Node', icon: '\u{1F3AF}', action: () => renderer.focusOnNode(nodeId) },
      { label: 'Clear Highlight', icon: '\u2716', action: () => renderer.clearHighlight() },
    ];

    for (const item of menuItems) {
      if (item === 'divider') {
        const hr = document.createElement('div');
        hr.className = 'context-menu-divider';
        contextMenu.appendChild(hr);
        continue;
      }
      const btn = document.createElement('button');
      btn.className = 'context-menu-item';
      btn.innerHTML = `<span class="ctx-icon">${item.icon}</span>${item.label}`;
      btn.addEventListener('click', () => {
        item.action();
        hideContextMenu();
      });
      contextMenu.appendChild(btn);
    }

    let left = containerRect.left + renderedPos.x;
    let top = containerRect.top + renderedPos.y;
    contextMenu.classList.remove('hidden');

    const menuRect = contextMenu.getBoundingClientRect();
    if (left + menuRect.width > window.innerWidth) {
      left = window.innerWidth - menuRect.width - 10;
    }
    if (top + menuRect.height > window.innerHeight) {
      top = window.innerHeight - menuRect.height - 10;
    }

    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
  });

  function hideContextMenu(): void {
    contextMenu.classList.add('hidden');
  }

  document.addEventListener('click', () => hideContextMenu());

  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
      return;
    }

    const step = e.shiftKey ? PAN_STEP_FAST : PAN_STEP;

    switch (e.key) {
      case 'Escape':
        renderer.clearHighlight();
        focusModeNode = null;
        hideContextMenu();
        break;
      case 'ArrowUp':
        e.preventDefault();
        cy.panBy({ x: 0, y: step });
        break;
      case 'ArrowDown':
        e.preventDefault();
        cy.panBy({ x: 0, y: -step });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        cy.panBy({ x: step, y: 0 });
        break;
      case 'ArrowRight':
        e.preventDefault();
        cy.panBy({ x: -step, y: 0 });
        break;
      case '+':
      case '=':
        e.preventDefault();
        renderer.zoomIn();
        break;
      case '-':
      case '_':
        e.preventDefault();
        renderer.zoomOut();
        break;
      case '0':
        e.preventDefault();
        renderer.fitView();
        break;
      case 'f':
      case 'F':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          if (focusModeNode) {
            renderer.clearHighlight();
            focusModeNode = null;
          } else {
            const selected = cy.$(':selected');
            if (selected.length > 0 && selected[0].isNode()) {
              focusModeNode = selected[0].id();
              renderer.focusOnNode(focusModeNode);
            }
          }
        }
        break;
    }
  });
}
