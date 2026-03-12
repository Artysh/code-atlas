import type { GraphRenderer } from '../graph/renderer';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

export class Exporter {
  constructor(private renderer: GraphRenderer, private vscode: VsCodeApi) {
    const btnExport = document.getElementById('btn-export')!;
    const exportMenu = document.getElementById('export-menu')!;

    btnExport.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle('hidden');

      // Position the menu near the button
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
        const format = (btn as HTMLElement).dataset.format as 'png' | 'svg' | 'json';
        this.exportGraph(format);
        exportMenu.classList.add('hidden');
      });
    });
  }

  private generateSvg(): string {
    const cy = this.renderer.getCy();
    const bb = cy.elements().boundingBox();
    const padding = 40;
    const w = bb.w + padding * 2;
    const h = bb.h + padding * 2;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    svg += `<rect width="${w}" height="${h}" fill="#1E1E1E"/>`;

    cy.edges().forEach(edge => {
      const srcPos = edge.source().position();
      const tgtPos = edge.target().position();
      const x1 = srcPos.x - bb.x1 + padding;
      const y1 = srcPos.y - bb.y1 + padding;
      const x2 = tgtPos.x - bb.x1 + padding;
      const y2 = tgtPos.y - bb.y1 + padding;
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#666" stroke-width="1.5"/>`;
    });

    cy.nodes().forEach(node => {
      if (node.isParent()) { return; }
      const pos = node.position();
      const x = pos.x - bb.x1 + padding;
      const y = pos.y - bb.y1 + padding;
      const label = node.data('label') || '';
      svg += `<circle cx="${x}" cy="${y}" r="20" fill="#4FC1FF" stroke="#555"/>`;
      svg += `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="#E0E0E0" font-size="10" font-family="sans-serif">${this.escapeXml(label)}</text>`;
    });

    svg += '</svg>';
    return svg;
  }

  private escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  exportGraph(format: 'png' | 'svg' | 'json'): void {
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
          })),
        };
        this.vscode.postMessage({
          command: 'saveExport',
          format: 'json',
          data: JSON.stringify(graphData, null, 2),
        });
        break;
      }
    }
  }
}
