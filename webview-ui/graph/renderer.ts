import cytoscape from 'cytoscape';
import cytoscapeDagre from 'cytoscape-dagre';
import type { CyNodeData, CyEdgeData, LayoutType } from '../../src/types';

cytoscape.use(cytoscapeDagre);

const NODE_COLORS: Record<string, string> = {
  file:      '#5B9BD5',
  class:     '#E5C07B',
  function:  '#C678DD',
  component: '#56B6C2',
  route:     '#E06C75',
  module:    '#3D5A80',
  interface: '#98C379',
  enum:      '#D19A66',
  variable:  '#61AFEF',
};

const NODE_BORDER_COLORS: Record<string, string> = {
  file:      '#4A88BF',
  class:     '#C9A84E',
  function:  '#A85DB5',
  component: '#44A0AB',
  route:     '#C45660',
  module:    '#2E4A6B',
  interface: '#7DAF60',
  enum:      '#B87F4F',
  variable:  '#4E96D4',
};

const EDGE_GRADIENT_COLORS: Record<string, [string, string]> = {
  import:  ['#5C6370', '#8B95A5'],
  call:    ['#61AFEF', '#A0D4FF'],
  render:  ['#56B6C2', '#8CE0E8'],
  extends: ['#E5C07B', '#F0DCA0'],
  route:   ['#E06C75', '#F0A0A8'],
};

export class GraphRenderer {
  private cy: cytoscape.Core;
  private currentLayout: LayoutType = 'dagre';

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

    const layoutOptions: Record<string, cytoscape.LayoutOptions> = {
      dagre: {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 120,
        rankSep: 160,
        edgeSep: 50,
        animate: true,
        animationDuration: 600,
        animationEasing: 'ease-in-out-cubic',
        fit: false,
        padding: 60,
        ...commonStop,
      } as cytoscape.LayoutOptions,
      dagreLR: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 100,
        rankSep: 200,
        edgeSep: 40,
        animate: true,
        animationDuration: 600,
        animationEasing: 'ease-in-out-cubic',
        fit: false,
        padding: 60,
        ...commonStop,
      } as cytoscape.LayoutOptions,
      cose: {
        name: 'cose',
        idealEdgeLength: () => 280,
        nodeOverlap: 20,
        componentSpacing: 200,
        nodeRepulsion: () => 50000,
        gravity: 0.3,
        nestingFactor: 1.2,
        avoidOverlap: true,
        animate: true,
        animationDuration: 800,
        animationEasing: 'ease-in-out-cubic',
        fit: false,
        padding: 80,
        ...commonStop,
      } as cytoscape.LayoutOptions,
      breadthfirst: {
        name: 'breadthfirst',
        directed: true,
        avoidOverlap: true,
        spacingFactor: 3.0,
        maximal: false,
        animate: true,
        animationDuration: 600,
        animationEasing: 'ease-in-out-cubic',
        fit: false,
        padding: 80,
        ...commonStop,
      } as cytoscape.LayoutOptions,
      grid: {
        name: 'grid',
        rows: undefined,
        cols: undefined,
        avoidOverlap: true,
        animate: true,
        animationDuration: 500,
        animationEasing: 'ease-in-out-cubic',
        fit: false,
        padding: 80,
        spacingFactor: 2.0,
        ...commonStop,
      } as cytoscape.LayoutOptions,
      circle: {
        name: 'circle',
        avoidOverlap: true,
        startAngle: 0,
        animate: true,
        animationDuration: 500,
        animationEasing: 'ease-in-out-cubic',
        fit: false,
        padding: 80,
        spacingFactor: 2.5,
        ...commonStop,
      } as cytoscape.LayoutOptions,
    };

    const options = layoutOptions[name] || layoutOptions.dagre;
    this.cy.layout(options).run();
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
      const type = node.data('type');
      if (type) { types.add(type); }
    });
    return Array.from(types).sort();
  }

  filterByType(visibleTypes: Set<string>): void {
    this.cy.nodes().forEach(node => {
      const type = node.data('type');
      if (visibleTypes.has(type)) {
        node.style('display', 'element');
      } else {
        node.style('display', 'none');
      }
    });
    setTimeout(() => this.fitToContent(), 100);
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
          'font-size': 14,
          'font-family': '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
          'font-weight': 500,
          'color': '#FFFFFF',
          'text-outline-width': 0,
          'background-color': (ele: cytoscape.NodeSingular) =>
            NODE_COLORS[ele.data('type')] || '#888',
          'background-opacity': 0.94,
          'shape': 'round-rectangle',
          'width': (ele: cytoscape.NodeSingular) => {
            const label = ele.data('label') || '';
            return Math.max(label.length * 10 + 36, 120);
          },
          'height': 44,
          'padding': '12px',
          'border-width': 2,
          'border-color': (ele: cytoscape.NodeSingular) =>
            NODE_BORDER_COLORS[ele.data('type')] || '#666',
          'border-opacity': 1,
          'text-wrap': 'ellipsis',
          'text-max-width': (ele: cytoscape.NodeSingular) => {
            const label = ele.data('label') || '';
            return String(Math.max(label.length * 10 + 12, 96)) + 'px';
          },
          'text-overflow-wrap': 'anywhere',
          'overlay-padding': 6,
          'shadow-blur': 12,
          'shadow-color': 'rgba(0,0,0,0.4)',
          'shadow-offset-x': 0,
          'shadow-offset-y': 4,
          'shadow-opacity': 0.7,
          'transition-property': 'border-color, border-width, opacity, shadow-blur, shadow-opacity, background-opacity',
          'transition-duration': 300,
          'transition-timing-function': 'ease-in-out-sine',
        } as unknown as cytoscape.Css.Node,
      },

      /* ---- Compound (parent) nodes ---- */
      {
        selector: 'node:parent',
        style: {
          'background-opacity': 0.08,
          'background-color': (ele: cytoscape.NodeSingular) => {
            const children = ele.children();
            if (children.length > 0) {
              const childType = children[0].data('type');
              return NODE_COLORS[childType] || '#61AFEF';
            }
            return '#61AFEF';
          },
          'border-width': 1.5,
          'border-color': (ele: cytoscape.NodeSingular) => {
            const children = ele.children();
            if (children.length > 0) {
              const childType = children[0].data('type');
              return NODE_BORDER_COLORS[childType] || '#61AFEF';
            }
            return '#61AFEF';
          },
          'border-opacity': 0.5,
          'border-style': 'solid',
          'text-valign': 'top',
          'text-halign': 'center',
          'font-size': 13,
          'font-weight': 600,
          'color': '#ABB2BF',
          'padding': '36px',
          'shape': 'round-rectangle',
          'text-margin-y': -12,
          'shadow-blur': 6,
          'shadow-color': 'rgba(0,0,0,0.15)',
          'shadow-offset-y': 2,
          'shadow-opacity': 0.5,
          'text-transform': 'uppercase',
        } as unknown as cytoscape.Css.Node,
      },

      /* ---- Child nodes inside compound ---- */
      {
        selector: 'node:child',
        style: {
          'font-size': 13,
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
          'width': 2.5,
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
          'control-point-step-size': 60,
          'arrow-scale': 1.3,
          'opacity': 0.55,
          'label': 'data(label)',
          'font-size': 11,
          'text-rotation': 'autorotate',
          'color': '#999',
          'text-background-color': '#1E1E1E',
          'text-background-opacity': 0.85,
          'text-background-padding': '3px',
          'text-margin-y': -12,
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
          'line-dash-pattern': [10, 5],
          'line-color': '#61AFEF',
          'target-arrow-color': '#61AFEF',
          'width': 2,
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "render"]',
        style: {
          'line-style': 'dashed',
          'line-dash-pattern': [4, 4],
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
          'width': 3,
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "route"]',
        style: {
          'line-color': '#E06C75',
          'target-arrow-color': '#E06C75',
          'target-arrow-shape': 'triangle',
          'width': 3,
          'line-style': 'solid',
        } as unknown as cytoscape.Css.Edge,
      },

      /* ---- Edge hover ---- */
      {
        selector: 'edge:active',
        style: {
          'opacity': 1,
          'width': 4,
          'overlay-opacity': 0.05,
        } as unknown as cytoscape.Css.Edge,
      },

      /* ---- State classes ---- */
      {
        selector: '.highlighted',
        style: {
          'border-width': 3,
          'border-color': '#FFD700',
          'shadow-blur': 20,
          'shadow-color': 'rgba(255, 215, 0, 0.4)',
          'shadow-opacity': 1,
          'z-index': 999,
        } as unknown as cytoscape.Css.Node,
      },
      {
        selector: 'edge.highlighted',
        style: {
          'width': 4,
          'opacity': 1,
          'z-index': 999,
          'line-color': '#FFD700',
          'target-arrow-color': '#FFD700',
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: '.dimmed',
        style: {
          'opacity': 0.1,
        } as unknown as cytoscape.Css.Node,
      },
      {
        selector: '.focused',
        style: {
          'border-width': 4,
          'border-color': '#E06C75',
          'shadow-blur': 24,
          'shadow-color': 'rgba(224, 108, 117, 0.5)',
          'shadow-opacity': 1,
          'z-index': 1000,
        } as unknown as cytoscape.Css.Node,
      },
      {
        selector: 'node.hover-glow',
        style: {
          'shadow-blur': 18,
          'shadow-opacity': 0.9,
          'border-width': 3,
          'background-opacity': 1,
          'z-index': 500,
        } as unknown as cytoscape.Css.Node,
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 3,
          'border-color': '#FFFFFF',
          'shadow-blur': 16,
          'shadow-color': 'rgba(255,255,255,0.25)',
          'shadow-opacity': 0.9,
        } as unknown as cytoscape.Css.Node,
      },
    ];
  }
}
