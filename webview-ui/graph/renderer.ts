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

export class GraphRenderer {
  private cy: cytoscape.Core;
  private currentLayout: LayoutType = 'dagre';

  constructor(container: HTMLElement) {
    this.cy = cytoscape({
      container,
      style: this.getStylesheet(),
      wheelSensitivity: 0.25,
      minZoom: 0.05,
      maxZoom: 4,
      boxSelectionEnabled: false,
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

    const layoutOptions: Record<string, cytoscape.LayoutOptions> = {
      dagre: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 100,
        rankSep: 140,
        edgeSep: 40,
        animate: true,
        animationDuration: 500,
        fit: true,
        padding: 50,
      } as cytoscape.LayoutOptions,
      cose: {
        name: 'cose',
        idealEdgeLength: () => 180,
        nodeOverlap: 40,
        componentSpacing: 140,
        nodeRepulsion: () => 12000,
        animate: true,
        animationDuration: 600,
        fit: true,
        padding: 50,
      } as cytoscape.LayoutOptions,
      breadthfirst: {
        name: 'breadthfirst',
        directed: true,
        spacingFactor: 2.0,
        animate: true,
        animationDuration: 500,
        fit: true,
        padding: 50,
      } as cytoscape.LayoutOptions,
      grid: {
        name: 'grid',
        rows: undefined,
        cols: undefined,
        animate: true,
        animationDuration: 400,
        fit: true,
        padding: 50,
        spacingFactor: 1.5,
      } as cytoscape.LayoutOptions,
      circle: {
        name: 'circle',
        animate: true,
        animationDuration: 400,
        fit: true,
        padding: 50,
        spacingFactor: 1.8,
      } as cytoscape.LayoutOptions,
    };

    const options = layoutOptions[name] || layoutOptions.dagre;
    this.cy.layout(options).run();
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
      duration: 400,
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
      duration: 400,
    });
  }

  fitView(): void {
    this.cy.fit(undefined, 60);
  }

  zoomIn(): void {
    this.cy.zoom({
      level: this.cy.zoom() * 1.3,
      renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 },
    });
  }

  zoomOut(): void {
    this.cy.zoom({
      level: this.cy.zoom() / 1.3,
      renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 },
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
          'font-size': 13,
          'font-family': '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
          'font-weight': 'normal',
          'color': '#FFFFFF',
          'text-outline-width': 0,
          'background-color': (ele: cytoscape.NodeSingular) =>
            NODE_COLORS[ele.data('type')] || '#888',
          'background-opacity': 0.92,
          'shape': 'round-rectangle',
          'width': (ele: cytoscape.NodeSingular) => {
            const label = ele.data('label') || '';
            return Math.max(label.length * 9 + 32, 100);
          },
          'height': 38,
          'padding': '10px',
          'border-width': 2,
          'border-color': (ele: cytoscape.NodeSingular) =>
            NODE_BORDER_COLORS[ele.data('type')] || '#666',
          'border-opacity': 0.9,
          'text-wrap': 'ellipsis',
          'text-max-width': (ele: cytoscape.NodeSingular) => {
            const label = ele.data('label') || '';
            return String(Math.max(label.length * 9 + 12, 80)) + 'px';
          },
          'text-overflow-wrap': 'anywhere',
          'overlay-padding': 4,
          'transition-property': 'border-color, border-width, opacity',
          'transition-duration': 200,
        } as unknown as cytoscape.Css.Node,
      },

      /* ---- Compound (parent) nodes ---- */
      {
        selector: 'node:parent',
        style: {
          'background-opacity': 0.06,
          'background-color': '#61AFEF',
          'border-width': 2,
          'border-color': '#61AFEF',
          'border-opacity': 0.35,
          'border-style': 'dashed',
          'text-valign': 'top',
          'text-halign': 'center',
          'font-size': 14,
          'font-weight': 'bold',
          'color': '#61AFEF',
          'padding': '28px',
          'shape': 'round-rectangle',
          'text-margin-y': -8,
        } as unknown as cytoscape.Css.Node,
      },

      /* ---- Edges ---- */
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#5C6370',
          'target-arrow-color': '#5C6370',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'arrow-scale': 1.1,
          'opacity': 0.65,
          'transition-property': 'opacity, line-color',
          'transition-duration': 200,
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "call"]',
        style: {
          'line-style': 'dashed',
          'line-dash-pattern': [8, 4],
          'line-color': '#61AFEF',
          'target-arrow-color': '#61AFEF',
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "render"]',
        style: {
          'line-style': 'dotted',
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
          'width': 2.5,
        } as unknown as cytoscape.Css.Edge,
      },
      {
        selector: 'edge[type = "route"]',
        style: {
          'line-color': '#E06C75',
          'target-arrow-color': '#E06C75',
        } as unknown as cytoscape.Css.Edge,
      },

      /* ---- State classes ---- */
      {
        selector: '.highlighted',
        style: {
          'border-width': 3,
          'border-color': '#FFD700',
          'z-index': 999,
        } as unknown as cytoscape.Css.Node,
      },
      {
        selector: 'edge.highlighted',
        style: {
          'width': 3.5,
          'opacity': 1,
          'z-index': 999,
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
          'border-width': 4,
          'border-color': '#E06C75',
          'z-index': 1000,
        } as unknown as cytoscape.Css.Node,
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 3,
          'border-color': '#FFFFFF',
        } as unknown as cytoscape.Css.Node,
      },
    ];
  }
}
