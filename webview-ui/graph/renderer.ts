import cytoscape from 'cytoscape';
import cytoscapeDagre from 'cytoscape-dagre';
import type { CyNodeData, CyEdgeData, LayoutType } from '../../src/types';

cytoscape.use(cytoscapeDagre);

const NODE_COLORS: Record<string, string> = {
  file:         '#5B9BD5',
  class:        '#E5C07B',
  function:     '#C678DD',
  component:    '#56B6C2',
  route:        '#E06C75',
  module:       '#3D5A80',
  interface:    '#98C379',
  enum:         '#D19A66',
  variable:     '#61AFEF',
  k8sResource:  '#326CE5',
  argoResource: '#EF7B4D',
  helmChart:    '#0F1689',
  namespace:    '#6B7280',
};

const NODE_BORDER_COLORS: Record<string, string> = {
  file:         '#4A88BF',
  class:        '#C9A84E',
  function:     '#A85DB5',
  component:    '#44A0AB',
  route:        '#C45660',
  module:       '#2E4A6B',
  interface:    '#7DAF60',
  enum:         '#B87F4F',
  variable:     '#4E96D4',
  k8sResource:  '#2557B8',
  argoResource: '#D4683E',
  helmChart:    '#0D1270',
  namespace:    '#565D66',
};

const EDGE_GRADIENT_COLORS: Record<string, [string, string]> = {
  import:     ['#5C6370', '#8B95A5'],
  call:       ['#61AFEF', '#A0D4FF'],
  render:     ['#56B6C2', '#8CE0E8'],
  extends:    ['#E5C07B', '#F0DCA0'],
  route:      ['#E06C75', '#F0A0A8'],
  deploys:    ['#326CE5', '#6B9BF0'],
  exposes:    ['#98C379', '#B8D9A0'],
  configures: ['#D19A66', '#E8BA90'],
  mounts:     ['#C678DD', '#D9A0EE'],
  selects:    ['#56B6C2', '#8CE0E8'],
  targets:    ['#E06C75', '#F0A0A8'],
  contains:   ['#6B7280', '#9CA3AF'],
  syncs:      ['#EF7B4D', '#F5A080'],
  triggers:   ['#E5C07B', '#F0DCA0'],
  depends:    ['#61AFEF', '#A0D4FF'],
  references: ['#5C6370', '#8B95A5'],
};

export class GraphRenderer {
  private cy: cytoscape.Core;
  private currentLayout: LayoutType = 'dagre';
  private _manuallyHidden = new Set<string>();
  private _detachedChildren = new Map<string, string[]>();

  constructor(container: HTMLElement) {
    this.cy = cytoscape({
      container,
      style: this.getStylesheet(),
      wheelSensitivity: 0.4,
      minZoom: 0.05,
      maxZoom: 4,
      boxSelectionEnabled: false,
      panningEnabled: true,
      userPanningEnabled: true,
      pixelRatio: 'auto',
    });

    this.cy.on('layoutstop', () => {
      this.fitToContent();
    });
  }

  getCy(): cytoscape.Core {
    return this.cy;
  }

  setData(nodes: CyNodeData[], edges: CyEdgeData[]): void {
    this._savedParents.clear();
    this._manuallyHidden.clear();
    this._detachedChildren.clear();
    this.cy.elements().remove();
    this.cy.add(nodes as cytoscape.ElementDefinition[]);
    this.cy.add(edges as cytoscape.ElementDefinition[]);
    this.applyLayout(this.currentLayout);
  }

  applyLayout(name: LayoutType): void {
    this.currentLayout = name;

    const commonStop = {
      stop: () => { this.fitToContent(); },
    };

    const needsFlatten = name === 'grid' || name === 'circle';

    if (needsFlatten) {
      this.flattenParents();
    } else {
      this.restoreParents();
    }

    const layoutOptions: Record<string, cytoscape.LayoutOptions> = {
      dagre: {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 60,
        rankSep: 80,
        edgeSep: 30,
        animate: true,
        animationDuration: 500,
        animationEasing: 'ease-in-out-cubic',
        fit: false,
        padding: 40,
        ...commonStop,
      } as cytoscape.LayoutOptions,
      dagreLR: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 50,
        rankSep: 100,
        edgeSep: 25,
        animate: true,
        animationDuration: 500,
        animationEasing: 'ease-in-out-cubic',
        fit: false,
        padding: 40,
        ...commonStop,
      } as cytoscape.LayoutOptions,
      grid: {
        name: 'grid',
        avoidOverlap: true,
        condense: true,
        animate: true,
        animationDuration: 400,
        animationEasing: 'ease-in-out-cubic',
        fit: false,
        padding: 30,
        spacingFactor: 1.2,
        ...commonStop,
      } as cytoscape.LayoutOptions,
      circle: {
        name: 'concentric',
        avoidOverlap: true,
        minNodeSpacing: 40,
        concentric: (node: cytoscape.NodeSingular) => node.connectedEdges().length,
        levelWidth: () => 2,
        animate: true,
        animationDuration: 500,
        animationEasing: 'ease-in-out-cubic',
        fit: false,
        padding: 30,
        ...commonStop,
      } as cytoscape.LayoutOptions,
    };

    const options = layoutOptions[name] || layoutOptions.dagre;

    if (needsFlatten) {
      const leafNodes = this.cy.nodes().filter(n => !n.isParent());
      leafNodes.layout(options).run();
    } else {
      this.cy.layout(options).run();
    }
  }

  private _savedParents = new Map<string, string>();

  private flattenParents(): void {
    this._savedParents.clear();
    const parentIds = new Set<string>();
    this.cy.nodes().forEach(node => {
      const parentId = node.data('parent');
      if (parentId) {
        this._savedParents.set(node.id(), parentId);
        parentIds.add(parentId);
        node.move({ parent: null });
      }
    });
    for (const pid of parentIds) {
      const node = this.cy.getElementById(pid);
      if (node.length > 0) { node.style('display', 'none'); }
    }
  }

  private restoreParents(): void {
    const parentIds = new Set(this._savedParents.values());
    for (const pid of parentIds) {
      const node = this.cy.getElementById(pid);
      if (node.length > 0) { node.style('display', 'element'); }
    }
    this._savedParents.forEach((parentId, nodeId) => {
      const node = this.cy.getElementById(nodeId);
      if (node.length > 0) {
        node.move({ parent: parentId });
      }
    });
    this._savedParents.clear();
  }

  private fitToContent(): void {
    const visibleNodes = this.cy.nodes().filter(n => n.style('display') !== 'none');
    if (visibleNodes.length === 0) { return; }

    this.cy.animate({
      fit: { eles: visibleNodes, padding: 60 },
      duration: 400,
      easing: 'ease-in-out-cubic',
    });
  }

  highlightNodes(nodeIds: string[]): void {
    this.cy.elements().removeClass('highlighted dimmed focused');
    if (nodeIds.length === 0) { return; }

    const targets = this.cy.collection();
    for (const id of nodeIds) {
      targets.merge(this.cy.getElementById(id));
    }
    if (targets.length === 0) { return; }

    const connected = targets
      .union(targets.connectedEdges())
      .union(targets.connectedEdges().connectedNodes());

    this.cy.elements().addClass('dimmed');
    connected.removeClass('dimmed');
    targets.addClass('highlighted');

    this.cy.animate({
      fit: { eles: connected, padding: 80 },
      duration: 400,
      easing: 'ease-in-out-cubic',
    });
  }

  clearHighlight(): void {
    this.cy.elements().removeClass('highlighted dimmed focused');
  }

  focusOnNode(nodeId: string): void {
    const node = this.cy.getElementById(nodeId);
    if (node.length === 0) { return; }

    this.cy.elements().addClass('dimmed');
    const neighborhood = node.neighborhood().union(node);
    neighborhood.removeClass('dimmed');
    node.addClass('focused');

    this.cy.animate({
      fit: { eles: neighborhood, padding: 80 },
      duration: 500,
      easing: 'ease-in-out-cubic',
    });
  }

  centerOnNode(nodeId: string): void {
    const node = this.cy.getElementById(nodeId);
    if (node.length === 0) { return; }

    this.clearHighlight();
    node.addClass('focused');

    this.cy.animate({
      center: { eles: node },
      zoom: Math.max(this.cy.zoom(), 1.2),
      duration: 500,
      easing: 'ease-in-out-cubic',
    });
  }

  tracePath(sourceId: string, targetId: string): void {
    const source = this.cy.getElementById(sourceId);
    const target = this.cy.getElementById(targetId);
    if (source.length === 0 || target.length === 0) { return; }

    this.clearHighlight();
    const dijkstra = this.cy.elements().dijkstra({ root: source, weight: () => 1, directed: true });
    const pathToTarget = dijkstra.pathTo(target);

    this.cy.elements().addClass('dimmed');
    pathToTarget.removeClass('dimmed');
    pathToTarget.addClass('highlighted');

    this.cy.animate({
      fit: { eles: pathToTarget, padding: 80 },
      duration: 500,
      easing: 'ease-in-out-cubic',
    });
  }

  fitView(): void {
    this.fitToContent();
  }

  zoomIn(): void {
    const center = { x: this.cy.width() / 2, y: this.cy.height() / 2 };
    this.cy.animate({
      zoom: { level: this.cy.zoom() * 1.3, renderedPosition: center },
      duration: 250,
      easing: 'ease-out-cubic',
    });
  }

  zoomOut(): void {
    const center = { x: this.cy.width() / 2, y: this.cy.height() / 2 };
    this.cy.animate({
      zoom: { level: this.cy.zoom() / 1.3, renderedPosition: center },
      duration: 250,
      easing: 'ease-out-cubic',
    });
  }

  getNodeTypes(): string[] {
    const types = new Set<string>();
    this.cy.nodes().forEach(node => {
      if (node.isChild()) { return; }
      const type = node.data('type');
      if (type) { types.add(type); }
    });
    return Array.from(types).sort();
  }

  filterGroups(visibleGroupIds: Set<string>): void {
    const groupNodeIds: string[] = [];
    this.cy.nodes().forEach(node => {
      if (node.isParent() || this._detachedChildren.has(node.id())) {
        groupNodeIds.push(node.id());
      }
    });

    this.cy.batch(() => {
      for (const nodeId of groupNodeIds) {
        if (this._manuallyHidden.has(nodeId)) { continue; }
        const node = this.cy.getElementById(nodeId);
        if (visibleGroupIds.has(nodeId)) {
          this._reattachChildren(nodeId);
          node.style('display', 'element');
        } else {
          if (node.isParent()) {
            this._detachChildren(node as cytoscape.NodeSingular);
          }
          node.style('display', 'none');
        }
      }
      this._reconcileEdges();
    });
  }

  filterByType(visibleTypes: Set<string>): void {
    this.cy.batch(() => {
      this.cy.nodes().forEach(node => {
        if (this._manuallyHidden.has(node.id())) { return; }
        if (node.isParent() || this._detachedChildren.has(node.id())) { return; }
        const type = node.data('type');
        if (!type) { return; }
        node.style('display', visibleTypes.has(type) ? 'element' : 'none');
      });
      this._reconcileEdges();
    });
  }

  private _reconcileEdges(): void {
    this.cy.edges().forEach(edge => {
      const srcVisible = edge.source().style('display') !== 'none';
      const tgtVisible = edge.target().style('display') !== 'none';
      edge.style('display', (srcVisible && tgtVisible) ? 'element' : 'none');
    });
  }

  private _detachChildren(parentNode: cytoscape.NodeSingular): void {
    const parentId = parentNode.id();
    if (this._detachedChildren.has(parentId)) { return; }
    const childIds: string[] = [];
    parentNode.children().forEach((child: cytoscape.NodeSingular) => {
      childIds.push(child.id());
      child.move({ parent: null });
    });
    this._detachedChildren.set(parentId, childIds);
  }

  private _reattachChildren(parentId: string): void {
    const childIds = this._detachedChildren.get(parentId);
    if (!childIds) { return; }
    for (const childId of childIds) {
      const child = this.cy.getElementById(childId);
      if (child.length > 0) {
        child.move({ parent: parentId });
      }
    }
    this._detachedChildren.delete(parentId);
  }

  hideNode(nodeId: string): void {
    const node = this.cy.getElementById(nodeId);
    if (node.length === 0) { return; }
    this._manuallyHidden.add(nodeId);
    this.cy.batch(() => {
      if (node.isParent()) {
        this._detachChildren(node);
      }
      node.style('display', 'none');
      this._reconcileEdges();
    });
  }

  showAllHidden(): void {
    this.cy.batch(() => {
      for (const id of this._manuallyHidden) {
        this._reattachChildren(id);
        const node = this.cy.getElementById(id);
        if (node.length > 0) {
          node.style('display', 'element');
        }
      }
      this._manuallyHidden.clear();
      this._reconcileEdges();
    });
  }

  getHiddenCount(): number {
    return this._manuallyHidden.size;
  }

  searchNodes(query: string): cytoscape.NodeCollection {
    if (!query) { return this.cy.collection() as cytoscape.NodeCollection; }
    const lower = query.toLowerCase();
    return this.cy.nodes().filter(node => {
      const label = (node.data('label') || '').toLowerCase();
      const filePath = (node.data('filePath') || '').toLowerCase();
      return label.includes(lower) || filePath.includes(lower);
    });
  }

  expandAll(): void {
    this.cy.nodes(':parent').forEach(node => {
      (node as cytoscape.NodeSingular).style('visibility', 'visible');
    });
  }

  collapseAll(): void {
    this.cy.nodes(':parent').forEach(parent => {
      parent.children().forEach(child => {
        child.style('visibility', 'hidden');
      });
    });
  }

  destroy(): void {
    this.cy.destroy();
  }

  private getStylesheet(): cytoscape.StylesheetStyle[] {
    return [
      /* ---- Nodes ---- */
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': 12,
          'font-family': '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
          'font-weight': 500,
          'color': '#FFFFFF',
          'text-outline-width': 0,
          'background-color': (ele: cytoscape.NodeSingular) =>
            NODE_COLORS[ele.data('type')] || '#888',
          'background-opacity': 0.92,
          'shape': 'round-rectangle',
          'width': (ele: cytoscape.NodeSingular) => {
            const label = ele.data('label') || '';
            return Math.max(label.length * 8 + 28, 90);
          },
          'height': 34,
          'padding': '8px',
          'border-width': 1.5,
          'border-color': (ele: cytoscape.NodeSingular) =>
            NODE_BORDER_COLORS[ele.data('type')] || '#666',
          'border-opacity': 1,
          'text-wrap': 'ellipsis',
          'text-max-width': (ele: cytoscape.NodeSingular) => {
            const label = ele.data('label') || '';
            return String(Math.max(label.length * 8 + 8, 80)) + 'px';
          },
          'text-overflow-wrap': 'anywhere',
          'overlay-padding': 4,
          'shadow-blur': 8,
          'shadow-color': 'rgba(0,0,0,0.3)',
          'shadow-offset-x': 0,
          'shadow-offset-y': 2,
          'shadow-opacity': 0.5,
          'transition-property': 'border-color, border-width, opacity, shadow-blur, shadow-opacity, background-opacity',
          'transition-duration': 300,
          'transition-timing-function': 'ease-in-out-sine',
        } as unknown as cytoscape.Css.Node,
      },

      /* ---- Compound (parent) nodes ---- */
      {
        selector: 'node:parent',
        style: {
          'background-opacity': 0.06,
          'background-color': (ele: cytoscape.NodeSingular) => {
            const children = ele.children();
            if (children.length > 0) {
              const childType = children[0].data('type');
              return NODE_COLORS[childType] || '#61AFEF';
            }
            return '#61AFEF';
          },
          'border-width': 1,
          'border-color': (ele: cytoscape.NodeSingular) => {
            const children = ele.children();
            if (children.length > 0) {
              const childType = children[0].data('type');
              return NODE_BORDER_COLORS[childType] || '#61AFEF';
            }
            return '#61AFEF';
          },
          'border-opacity': 0.4,
          'border-style': 'dashed',
          'text-valign': 'top',
          'text-halign': 'center',
          'font-size': 11,
          'font-weight': 600,
          'color': '#888',
          'padding': '18px',
          'shape': 'round-rectangle',
          'text-margin-y': -8,
          'shadow-blur': 0,
          'shadow-opacity': 0,
          'text-transform': 'uppercase',
        } as unknown as cytoscape.Css.Node,
      },

      /* ---- Child nodes inside compound ---- */
      {
        selector: 'node:child',
        style: {
          'font-size': 11,
          'width': (ele: cytoscape.NodeSingular) => {
            const label = ele.data('label') || '';
            return Math.max(label.length * 7 + 20, 70);
          },
          'height': 28,
        } as unknown as cytoscape.Css.Node,
      },

      /* ---- Node hover ---- */
      {
        selector: 'node:active',
        style: {
          'overlay-opacity': 0.08,
          'overlay-color': '#FFFFFF',
        } as unknown as cytoscape.Css.Node,
      },

      /* ---- Edges ---- */
      {
        selector: 'edge',
        style: {
          'width': 1.5,
          'line-color': (ele: cytoscape.EdgeSingular) => {
            const type = ele.data('type') || 'import';
            return (EDGE_GRADIENT_COLORS[type] || EDGE_GRADIENT_COLORS.import)[0];
          },
          'target-arrow-color': (ele: cytoscape.EdgeSingular) => {
            const type = ele.data('type') || 'import';
            return (EDGE_GRADIENT_COLORS[type] || EDGE_GRADIENT_COLORS.import)[0];
          },
          'target-arrow-shape': 'vee',
          'curve-style': 'bezier',
          'control-point-step-size': 40,
          'arrow-scale': 1.0,
          'opacity': 0.5,
          'label': 'data(label)',
          'font-size': 9,
          'text-rotation': 'autorotate',
          'color': '#888',
          'text-background-color': '#1E1E1E',
          'text-background-opacity': 0.85,
          'text-background-padding': '2px',
          'text-margin-y': -8,
          'line-cap': 'round',
          'transition-property': 'opacity, line-color, width, target-arrow-color',
          'transition-duration': 300,
          'transition-timing-function': 'ease-in-out-sine',
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "call"]',
        style: {
          'line-style': 'dashed',
          'line-dash-pattern': [8, 4],
          'line-color': '#61AFEF',
          'target-arrow-color': '#61AFEF',
          'width': 1.5,
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "render"]',
        style: {
          'line-style': 'dashed',
          'line-dash-pattern': [4, 3],
          'line-color': '#56B6C2',
          'target-arrow-color': '#56B6C2',
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "extends"]',
        style: {
          'line-color': '#E5C07B',
          'target-arrow-color': '#E5C07B',
          'target-arrow-shape': 'triangle-tee',
          'width': 2,
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "route"]',
        style: {
          'line-color': '#E06C75',
          'target-arrow-color': '#E06C75',
          'target-arrow-shape': 'triangle',
          'width': 2,
          'line-style': 'solid',
        } as unknown as cytoscape.Css.Edge,
      },

      /* ---- K8s / Argo edge styles ---- */
      {
        selector: 'edge[type = "deploys"], edge[type = "syncs"]',
        style: {
          'line-color': '#326CE5',
          'target-arrow-color': '#326CE5',
          'target-arrow-shape': 'triangle',
          'width': 2,
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "exposes"], edge[type = "selects"]',
        style: {
          'line-color': '#98C379',
          'target-arrow-color': '#98C379',
          'target-arrow-shape': 'vee',
          'width': 1.5,
          'line-style': 'dashed',
          'line-dash-pattern': [6, 3],
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "configures"], edge[type = "mounts"]',
        style: {
          'line-color': '#D19A66',
          'target-arrow-color': '#D19A66',
          'target-arrow-shape': 'vee',
          'line-style': 'dashed',
          'line-dash-pattern': [4, 4],
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "triggers"]',
        style: {
          'line-color': '#EF7B4D',
          'target-arrow-color': '#EF7B4D',
          'target-arrow-shape': 'triangle',
          'width': 2,
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "targets"], edge[type = "depends"]',
        style: {
          'line-color': '#61AFEF',
          'target-arrow-color': '#61AFEF',
          'line-style': 'dashed',
          'line-dash-pattern': [8, 4],
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "contains"]',
        style: {
          'line-color': '#6B7280',
          'target-arrow-color': '#6B7280',
          'target-arrow-shape': 'circle',
          'width': 1,
          'opacity': 0.4,
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "references"]',
        style: {
          'line-color': '#5C6370',
          'target-arrow-color': '#5C6370',
          'line-style': 'dotted',
          'width': 1,
        } as unknown as cytoscape.Css.Edge,
      },

      /* ---- Phantom / unresolved K8s nodes ---- */
      {
        selector: 'node[?isPhantom]',
        style: {
          'border-style': 'dashed',
          'border-width': 2,
          'background-opacity': 0.5,
        } as unknown as cytoscape.Css.Node,
      },

      /* ---- Edge hover ---- */
      {
        selector: 'edge:active',
        style: {
          'opacity': 0.9,
          'width': 3,
          'overlay-opacity': 0.04,
        } as unknown as cytoscape.Css.Edge,
      },

      /* ---- State classes ---- */
      {
        selector: '.highlighted',
        style: {
          'border-width': 2.5,
          'border-color': '#FFD700',
          'shadow-blur': 14,
          'shadow-color': 'rgba(255, 215, 0, 0.35)',
          'shadow-opacity': 1,
          'z-index': 999,
        } as unknown as cytoscape.Css.Node,
      },
      {
        selector: 'edge.highlighted',
        style: {
          'width': 3,
          'opacity': 1,
          'z-index': 999,
          'line-color': '#FFD700',
          'target-arrow-color': '#FFD700',
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: '.dimmed',
        style: {
          'opacity': 0.12,
        } as unknown as cytoscape.Css.Node,
      },
      {
        selector: '.focused',
        style: {
          'border-width': 2.5,
          'border-color': '#E06C75',
          'shadow-blur': 16,
          'shadow-color': 'rgba(224, 108, 117, 0.4)',
          'shadow-opacity': 1,
          'z-index': 1000,
        } as unknown as cytoscape.Css.Node,
      },
      {
        selector: 'node.hover-glow',
        style: {
          'shadow-blur': 12,
          'shadow-opacity': 0.8,
          'border-width': 2,
          'background-opacity': 1,
          'z-index': 500,
        } as unknown as cytoscape.Css.Node,
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 2,
          'border-color': '#FFFFFF',
          'shadow-blur': 10,
          'shadow-color': 'rgba(255,255,255,0.2)',
          'shadow-opacity': 0.8,
        } as unknown as cytoscape.Css.Node,
      },
    ];
  }
}
