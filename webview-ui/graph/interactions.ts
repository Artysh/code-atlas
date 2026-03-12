import cytoscape from 'cytoscape';
import type { GraphRenderer } from './renderer';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

export function setupInteractions(renderer: GraphRenderer, vscode: VsCodeApi): void {
  const cy = renderer.getCy();
  const tooltip = document.getElementById('tooltip')!;
  const contextMenu = document.getElementById('context-menu')!;

  let focusModeNode: string | null = null;

  // Click node -> open file in editor
  cy.on('tap', 'node', (event) => {
    const node = event.target;
    const filePath = node.data('filePath');
    if (!filePath) { return; }

    // Don't open compound nodes
    if (node.isParent()) { return; }

    vscode.postMessage({
      command: 'openFile',
      filePath,
      line: node.data('line'),
      column: node.data('column'),
    });
  });

  // Click background -> clear highlight
  cy.on('tap', (event) => {
    if (event.target === cy) {
      renderer.clearHighlight();
      focusModeNode = null;
      hideContextMenu();
    }
  });

  // Double-click node -> focus mode (show only connected nodes)
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

  // Hover -> show tooltip
  cy.on('mouseover', 'node', (event) => {
    const node = event.target;
    if (node.isParent()) { return; }

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

    tooltip.style.left = `${containerRect.left + renderedPos.x + 20}px`;
    tooltip.style.top = `${containerRect.top + renderedPos.y - 10}px`;
  });

  cy.on('mouseout', 'node', () => {
    tooltip.classList.add('hidden');
  });

  // Right-click -> context menu
  cy.on('cxttap', 'node', (event) => {
    const node = event.target;
    if (node.isParent()) { return; }

    event.originalEvent?.preventDefault?.();

    const nodeId = node.id();
    const renderedPos = node.renderedPosition();
    const containerRect = cy.container()!.getBoundingClientRect();

    contextMenu.innerHTML = '';

    const menuItems = [
      { label: 'Open File', action: () => {
        vscode.postMessage({
          command: 'openFile',
          filePath: node.data('filePath'),
          line: node.data('line'),
        });
      }},
      { label: 'Focus on Node', action: () => renderer.focusOnNode(nodeId) },
      { label: 'Show Dependents', action: () => {
        const depIds: string[] = [];
        node.incomers().nodes().forEach((n: cytoscape.NodeSingular) => { depIds.push(n.id()); });
        renderer.highlightNodes([nodeId, ...depIds]);
      }},
      { label: 'Show Dependencies', action: () => {
        const depIds: string[] = [];
        node.outgoers().nodes().forEach((n: cytoscape.NodeSingular) => { depIds.push(n.id()); });
        renderer.highlightNodes([nodeId, ...depIds]);
      }},
      { label: 'Clear Highlight', action: () => renderer.clearHighlight() },
    ];

    for (const item of menuItems) {
      const btn = document.createElement('button');
      btn.className = 'context-menu-item';
      btn.textContent = item.label;
      btn.addEventListener('click', () => {
        item.action();
        hideContextMenu();
      });
      contextMenu.appendChild(btn);
    }

    contextMenu.style.left = `${containerRect.left + renderedPos.x}px`;
    contextMenu.style.top = `${containerRect.top + renderedPos.y}px`;
    contextMenu.classList.remove('hidden');
  });

  function hideContextMenu(): void {
    contextMenu.classList.add('hidden');
  }

  // Hide context menu on any click
  document.addEventListener('click', () => hideContextMenu());

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      renderer.clearHighlight();
      focusModeNode = null;
      hideContextMenu();
    }
  });
}
