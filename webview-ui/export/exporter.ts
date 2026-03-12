import type { GraphRenderer } from '../graph/renderer';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

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

export class Exporter {
  constructor(private renderer: GraphRenderer, private vscode: VsCodeApi) {
    const btnExport = document.getElementById('btn-export')!;
    const exportMenu = document.getElementById('export-menu')!;

    btnExport.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle('hidden');

      const rect = btnExport.getBoundingClientRect();
      exportMenu.style.left = `${rect.left}px`;
      exportMenu.style.top = `${rect.bottom + 4}px`;
    });

    document.addEventListener('click', () => {
      exportMenu.classList.add('hidden');
    });

    const options = exportMenu.querySelectorAll('.popup-item');
    options.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const format = (btn as HTMLElement).dataset.format as 'png' | 'svg' | 'json' | 'drawio';
        this.exportGraph(format);
        exportMenu.classList.add('hidden');
      });
    });
  }

  private generateSvg(): string {
    const cy = this.renderer.getCy();
    const bb = cy.elements().boundingBox();
    const padding = 60;
    const w = bb.w + padding * 2;
    const h = bb.h + padding * 2;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    svg += `<defs>`;
    svg += `<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#888"/></marker>`;
    svg += `</defs>`;
    svg += `<rect width="${w}" height="${h}" fill="#1E1E1E"/>`;

    cy.edges().forEach(edge => {
      if (edge.style('display') === 'none') { return; }
      const srcPos = edge.source().position();
      const tgtPos = edge.target().position();
      const x1 = srcPos.x - bb.x1 + padding;
      const y1 = srcPos.y - bb.y1 + padding;
      const x2 = tgtPos.x - bb.x1 + padding;
      const y2 = tgtPos.y - bb.y1 + padding;
      const edgeType = edge.data('type') || 'import';
      const color = edgeType === 'call' ? '#61AFEF' : edgeType === 'render' ? '#56B6C2' : '#666';
      const dashAttr = edgeType === 'call' ? ' stroke-dasharray="8,4"' : '';
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.5" marker-end="url(#arrowhead)"${dashAttr}/>`;

      const label = edge.data('label');
      if (label) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        svg += `<text x="${mx}" y="${my - 6}" text-anchor="middle" fill="#999" font-size="9" font-family="sans-serif">${this.escapeXml(label)}</text>`;
      }
    });

    cy.nodes().forEach(node => {
      if (node.style('display') === 'none') { return; }
      if (node.isParent()) { return; }
      const pos = node.position();
      const x = pos.x - bb.x1 + padding;
      const y = pos.y - bb.y1 + padding;
      const label = node.data('label') || '';
      const type = node.data('type') || 'file';
      const fill = NODE_COLORS[type] || '#888';
      const nw = Math.max(label.length * 8 + 24, 80);
      const nh = 32;

      svg += `<rect x="${x - nw / 2}" y="${y - nh / 2}" width="${nw}" height="${nh}" rx="6" fill="${fill}" stroke="${fill}" stroke-opacity="0.6"/>`;
      svg += `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="#FFF" font-size="11" font-family="sans-serif">${this.escapeXml(label)}</text>`;
    });

    svg += '</svg>';
    return svg;
  }

  private generateDrawio(): string {
    const cy = this.renderer.getCy();
    const nodes = cy.nodes().filter(n => n.style('display') !== 'none' && !n.isParent());
    const edges = cy.edges().filter(e => e.style('display') !== 'none');

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<mxfile host="Code Atlas">\n';
    xml += '  <diagram name="Architecture">\n';
    xml += '    <mxGraphModel>\n';
    xml += '      <root>\n';
    xml += '        <mxCell id="0"/>\n';
    xml += '        <mxCell id="1" parent="0"/>\n';

    let cellId = 2;
    const nodeIdMap = new Map<string, number>();

    nodes.forEach(node => {
      const id = cellId++;
      nodeIdMap.set(node.id(), id);
      const pos = node.position();
      const label = node.data('label') || '';
      const type = node.data('type') || 'file';
      const fill = (NODE_COLORS[type] || '#888').replace('#', '');
      const nw = Math.max(label.length * 8 + 24, 100);
      const nh = 36;

      xml += `        <mxCell id="${id}" value="${this.escapeXml(label)}" `;
      xml += `style="rounded=1;whiteSpace=wrap;fillColor=#${fill};fontColor=#FFFFFF;strokeColor=#444444;fontSize=12;" `;
      xml += `vertex="1" parent="1">\n`;
      xml += `          <mxGeometry x="${Math.round(pos.x - nw / 2)}" y="${Math.round(pos.y - nh / 2)}" width="${nw}" height="${nh}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });

    edges.forEach(edge => {
      const id = cellId++;
      const sourceId = nodeIdMap.get(edge.source().id());
      const targetId = nodeIdMap.get(edge.target().id());
      if (sourceId === undefined || targetId === undefined) { return; }

      const label = edge.data('label') || '';
      const edgeType = edge.data('type') || 'import';
      const dashed = edgeType === 'call' ? 'dashed=1;' : '';

      xml += `        <mxCell id="${id}" value="${this.escapeXml(label)}" `;
      xml += `style="edgeStyle=orthogonalEdgeStyle;${dashed}rounded=1;strokeColor=#888888;fontSize=9;" `;
      xml += `edge="1" parent="1" source="${sourceId}" target="${targetId}">\n`;
      xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });

    xml += '      </root>\n';
    xml += '    </mxGraphModel>\n';
    xml += '  </diagram>\n';
    xml += '</mxfile>';

    return xml;
  }

  private escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  exportGraph(format: 'png' | 'svg' | 'json' | 'drawio'): void {
    const cy = this.renderer.getCy();

    switch (format) {
      case 'png': {
        const pngData = cy.png({
          output: 'base64',
          bg: '#1E1E1E',
          full: true,
          scale: 2,
        });
        this.vscode.postMessage({
          command: 'saveExport',
          format: 'png',
          data: pngData,
        });
        break;
      }

      case 'svg': {
        const svgContent = this.generateSvg();
        this.vscode.postMessage({
          command: 'saveExport',
          format: 'svg',
          data: svgContent,
        });
        break;
      }

      case 'json': {
        const graphData = {
          nodes: cy.nodes().map(n => ({
            id: n.id(),
            label: n.data('label'),
            type: n.data('type'),
            filePath: n.data('filePath'),
            position: n.position(),
          })),
          edges: cy.edges().map(e => ({
            id: e.id(),
            source: e.data('source'),
            target: e.data('target'),
            type: e.data('type'),
            label: e.data('label'),
          })),
        };
        this.vscode.postMessage({
          command: 'saveExport',
          format: 'json',
          data: JSON.stringify(graphData, null, 2),
        });
        break;
      }

      case 'drawio': {
        const drawioContent = this.generateDrawio();
        this.vscode.postMessage({
          command: 'saveExport',
          format: 'drawio',
          data: drawioContent,
        });
        break;
      }
    }
  }
}
