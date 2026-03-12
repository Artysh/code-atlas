import cytoscape from 'cytoscape';
import type { GraphRenderer } from './renderer';
import type { FileDepsPanel } from '../ui/fileDepsPanel';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

type MenuItem = { label: string; icon: string; action: () => void } | 'divider';

const NODE_COLORS: Record<string, string> = {
  file: '#5B9BD5', class: '#E5C07B', function: '#C678DD', component: '#56B6C2',
  route: '#E06C75', module: '#3D5A80', interface: '#98C379', enum: '#D19A66', variable: '#61AFEF',
  k8sResource: '#326CE5', argoResource: '#EF7B4D', helmChart: '#0F1689', namespace: '#6B7280',
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildNodeTooltipHtml(node: cytoscape.NodeSingular, cy: cytoscape.Core): string {
  const label = node.data('label') || node.id();
  const type = node.data('type') || 'unknown';
  const filePath = node.data('filePath') || '';
  const line = node.data('line');
  const isParent = node.isParent();
  const color = NODE_COLORS[type] || '#888';

  const k8sKind = node.data('k8sKind');
  const k8sNamespace = node.data('k8sNamespace');
  const isPhantom = node.data('isPhantom');

  let html = '';
  html += `<div class="tt-header">`;
  if (k8sKind) {
    html += `<span class="tt-badge" style="background:${color}">${k8sKind}</span>`;
  } else {
    html += `<span class="tt-badge" style="background:${color}">${type}</span>`;
  }
  html += `<strong class="tt-name">${escapeHtml(label)}</strong>`;
  if (isPhantom) {
    html += `<span class="tt-badge" style="background:#6B7280;margin-left:4px;font-size:9px">unresolved</span>`;
  }
  html += `</div>`;

  if (k8sNamespace) {
    html += `<div class="tooltip-path">namespace: ${escapeHtml(k8sNamespace)}</div>`;
  }

  if (filePath) {
    html += `<div class="tooltip-path">${escapeHtml(filePath)}`;
    if (line) { html += `<span class="tooltip-line">:${line}</span>`; }
    html += `</div>`;
  }

  if (isParent) {
    const children = node.children();
    html += `<div class="tt-divider"></div>`;
    html += `<div class="tt-section-title">Contains ${children.length} element${children.length !== 1 ? 's' : ''}</div>`;

    const collectNested = (parent: cytoscape.NodeSingular, depth: number): string => {
      let nested = '';
      const kids = parent.children();
      const maxShow = depth === 0 ? 12 : 6;
      const shown = kids.slice(0, maxShow);
      shown.forEach((child: cytoscape.NodeSingular) => {
        const cType = child.data('type') || 'file';
        const cColor = NODE_COLORS[cType] || '#888';
        const cLabel = child.data('label') || child.id();
        const indent = depth * 12;
        nested += `<div class="tt-child" style="padding-left:${indent + 12}px">`;
        nested += `<span class="tt-child-dot" style="background:${cColor}"></span>`;
        nested += `${escapeHtml(cLabel)}`;
        if (child.isParent()) {
          nested += ` <span class="tt-child-count">(${child.children().length})</span>`;
        }
        nested += `</div>`;
        if (child.isParent() && depth < 2) {
          nested += collectNested(child, depth + 1);
        }
      });
      if (kids.length > maxShow) {
        const indent = depth * 12;
        nested += `<div class="tt-child tt-more" style="padding-left:${indent + 12}px">+${kids.length - maxShow} more...</div>`;
      }
      return nested;
    };

    html += collectNested(node, 0);
  } else {
    const connEdges = node.connectedEdges();
    let incoming = 0, outgoing = 0;
    connEdges.forEach((e: cytoscape.EdgeSingular) => {
      if (e.target().id() === node.id()) { incoming++; }
      if (e.source().id() === node.id()) { outgoing++; }
    });

    html += `<div class="tt-divider"></div>`;
    html += `<div class="tt-stats-row"><span class="tt-stats-label">Connections</span><span class="tooltip-stats">${incoming} in / ${outgoing} out</span></div>`;

    const neighbors = node.neighborhood().nodes().filter((n: cytoscape.NodeSingular) => !n.isParent());
    if (neighbors.length > 0) {
      html += `<div class="tt-section-title">Connected to (${neighbors.length})</div>`;
      const shown = neighbors.slice(0, 8);
      shown.forEach((n: cytoscape.NodeSingular) => {
        const nType = n.data('type') || 'file';
        const nColor = NODE_COLORS[nType] || '#888';
        html += `<div class="tt-child"><span class="tt-child-dot" style="background:${nColor}"></span>${escapeHtml(n.data('label') || n.id())}</div>`;
      });
      if (neighbors.length > 8) {
        html += `<div class="tt-child tt-more">+${neighbors.length - 8} more...</div>`;
      }
    }
  }

  return html;
}

function buildEdgeTooltipHtml(edge: cytoscape.EdgeSingular): string {
  const type = edge.data('type') || 'import';
  const label = edge.data('label') || '';
  const sourceLabel = edge.source().data('label') || edge.source().id();
  const targetLabel = edge.target().data('label') || edge.target().id();

  let html = `<div class="tt-header"><span class="tt-badge" style="background:#5C6370">${type}</span></div>`;
  html += `<div class="tt-edge-flow">`;
  html += `<span class="tt-edge-node">${escapeHtml(sourceLabel)}</span>`;
  html += `<span class="tt-edge-arrow">\u2192</span>`;
  html += `<span class="tt-edge-node">${escapeHtml(targetLabel)}</span>`;
  html += `</div>`;
  if (label) {
    html += `<div class="tt-edge-label">${escapeHtml(label)}</div>`;
  }
  html += `<div class="tt-hint">Click to navigate between endpoints</div>`;
  return html;
}

function positionTooltip(tooltip: HTMLElement, renderedPos: { x: number; y: number }, containerRect: DOMRect): void {
  tooltip.classList.remove('hidden');

  const tooltipRect = tooltip.getBoundingClientRect();
  let left = containerRect.left + renderedPos.x + 10;
  let top = containerRect.top + renderedPos.y - 10;

  if (left + tooltipRect.width > window.innerWidth) {
    left = containerRect.left + renderedPos.x - tooltipRect.width - 10;
  }
  if (top + tooltipRect.height > window.innerHeight) {
    top = window.innerHeight - tooltipRect.height - 10;
  }
  if (top < 0) { top = 10; }
  if (left < 0) { left = 10; }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

export function setupInteractions(renderer: GraphRenderer, vscode: VsCodeApi, fileDepsPanel: FileDepsPanel): void {
  const cy = renderer.getCy();
  const tooltip = document.getElementById('tooltip')!;
  const contextMenu = document.getElementById('context-menu')!;

  let focusModeNode: string | null = null;
  let lastEdgeClickId: string | null = null;
  let lastEdgeClickToggle = false;
  const PAN_STEP = 50;
  const PAN_STEP_FAST = 150;

  let tooltipHideTimer: ReturnType<typeof setTimeout> | null = null;
  let isHoveringTooltip = false;

  function showTooltip(html: string, renderedPos: { x: number; y: number }): void {
    if (tooltipHideTimer) { clearTimeout(tooltipHideTimer); tooltipHideTimer = null; }
    tooltip.innerHTML = html;
    tooltip.scrollTop = 0;
    const containerRect = cy.container()!.getBoundingClientRect();
    positionTooltip(tooltip, renderedPos, containerRect);
  }

  function scheduleHideTooltip(): void {
    if (tooltipHideTimer) { clearTimeout(tooltipHideTimer); }
    tooltipHideTimer = setTimeout(() => {
      if (!isHoveringTooltip) {
        tooltip.classList.add('hidden');
      }
    }, 300);
  }

  tooltip.addEventListener('mouseenter', () => {
    isHoveringTooltip = true;
    if (tooltipHideTimer) { clearTimeout(tooltipHideTimer); tooltipHideTimer = null; }
  });

  tooltip.addEventListener('mouseleave', () => {
    isHoveringTooltip = false;
    scheduleHideTooltip();
  });

  tooltip.addEventListener('wheel', (e) => {
    e.stopPropagation();
  }, { passive: true });

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

  cy.on('tap', 'edge', (event) => {
    const edge = event.target;
    const sourceNode = edge.source();
    const targetNode = edge.target();
    const edgeId = edge.id();

    if (lastEdgeClickId === edgeId) {
      lastEdgeClickToggle = !lastEdgeClickToggle;
    } else {
      lastEdgeClickId = edgeId;
      lastEdgeClickToggle = false;
    }

    const focusTarget = lastEdgeClickToggle ? targetNode : sourceNode;
    renderer.clearHighlight();
    edge.addClass('highlighted');
    sourceNode.addClass('highlighted');
    targetNode.addClass('highlighted');

    cy.animate({
      center: { eles: focusTarget },
      zoom: Math.max(cy.zoom(), 1),
      duration: 400,
      easing: 'ease-in-out-cubic',
    });
  });

  cy.on('tap', (event) => {
    if (event.target === cy) {
      renderer.clearHighlight();
      focusModeNode = null;
      lastEdgeClickId = null;
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

    node.addClass('hover-glow');
    if (!node.isParent()) {
      node.connectedEdges().forEach((e: cytoscape.EdgeSingular) => {
        e.style('opacity', 0.85);
        e.style('width', 2.5);
      });
    }

    const html = buildNodeTooltipHtml(node, cy);
    showTooltip(html, node.renderedPosition());
  });

  cy.on('mouseout', 'node', (event) => {
    const node = event.target;
    node.removeClass('hover-glow');
    if (!node.isParent()) {
      node.connectedEdges().forEach((e: cytoscape.EdgeSingular) => {
        e.removeStyle('opacity');
        e.removeStyle('width');
      });
    }
    scheduleHideTooltip();
  });

  cy.on('mouseover', 'edge', (event) => {
    const edge = event.target;
    edge.style('opacity', 0.9);
    edge.style('width', 3);

    const html = buildEdgeTooltipHtml(edge);
    const midpoint = edge.midpoint();
    const zoom = cy.zoom();
    const pan = cy.pan();
    const rx = midpoint.x * zoom + pan.x;
    const ry = midpoint.y * zoom + pan.y;
    showTooltip(html, { x: rx, y: ry });
  });

  cy.on('mouseout', 'edge', (event) => {
    const edge = event.target;
    edge.removeStyle('opacity');
    edge.removeStyle('width');
    scheduleHideTooltip();
  });

  cy.on('cxttap', 'node', (event) => {
    const node = event.target;
    event.originalEvent?.preventDefault?.();

    const nodeId = node.id();
    const isParent = node.isParent();
    const renderedPos = node.renderedPosition();
    const containerRect = cy.container()!.getBoundingClientRect();

    contextMenu.innerHTML = '';

    const menuItems: MenuItem[] = [];

    if (!isParent) {
      menuItems.push(
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
        { label: 'Show Reverse Dependencies', icon: '\u{1F517}', action: () => {
          vscode.postMessage({ command: 'showFileImporters', filePath: node.data('filePath') });
        }},
        'divider',
      );
    }

    menuItems.push(
      { label: isParent ? 'Hide Group' : 'Hide Node', icon: '\u{1F6AB}', action: () => renderer.hideNode(nodeId) },
      { label: 'Focus on Node', icon: '\u{1F3AF}', action: () => renderer.focusOnNode(nodeId) },
      { label: 'Clear Highlight', icon: '\u2716', action: () => renderer.clearHighlight() },
    );

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
