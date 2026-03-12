import type { GraphRenderer } from '../graph/renderer';

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;

  constructor(container: HTMLElement, private renderer: GraphRenderer) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = container.clientWidth || 200;
    this.canvas.height = container.clientHeight || 130;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    const cy = renderer.getCy();

    // Pan to location on minimap click
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const extent = cy.extent();
      const graphWidth = extent.x2 - extent.x1;
      const graphHeight = extent.y2 - extent.y1;

      if (graphWidth === 0 || graphHeight === 0) { return; }

      const modelX = extent.x1 + (clickX / this.canvas.width) * graphWidth;
      const modelY = extent.y1 + (clickY / this.canvas.height) * graphHeight;

      cy.pan({
        x: cy.width() / 2 - modelX * cy.zoom(),
        y: cy.height() / 2 - modelY * cy.zoom(),
      });
    });

    // Auto-update on viewport changes
    cy.on('pan zoom resize', () => this.scheduleUpdate());
  }

  update(): void {
    this.draw();
  }

  private scheduleUpdate(): void {
    if (this.animFrameId !== null) { return; }
    this.animFrameId = requestAnimationFrame(() => {
      this.draw();
      this.animFrameId = null;
    });
  }

  private draw(): void {
    const cy = this.renderer.getCy();
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const nodes = cy.nodes().filter(n => n.visible());
    if (nodes.length === 0) { return; }

    const bb = nodes.boundingBox();
    const graphWidth = bb.w || 1;
    const graphHeight = bb.h || 1;
    const padding = 10;

    const scaleX = (w - padding * 2) / graphWidth;
    const scaleY = (h - padding * 2) / graphHeight;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = padding + ((w - padding * 2) - graphWidth * scale) / 2;
    const offsetY = padding + ((h - padding * 2) - graphHeight * scale) / 2;

    const toMiniX = (x: number) => offsetX + (x - bb.x1) * scale;
    const toMiniY = (y: number) => offsetY + (y - bb.y1) * scale;

    // Draw edges
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.lineWidth = 0.5;
    cy.edges().filter(e => e.visible()).forEach(edge => {
      const srcPos = edge.source().position();
      const tgtPos = edge.target().position();
      ctx.beginPath();
      ctx.moveTo(toMiniX(srcPos.x), toMiniY(srcPos.y));
      ctx.lineTo(toMiniX(tgtPos.x), toMiniY(tgtPos.y));
      ctx.stroke();
    });

    // Draw nodes as dots
    nodes.forEach(node => {
      if (node.isParent()) { return; }
      const pos = node.position();
      const x = toMiniX(pos.x);
      const y = toMiniY(pos.y);

      ctx.fillStyle = node.hasClass('dimmed')
        ? 'rgba(100, 100, 100, 0.3)'
        : 'rgba(91, 155, 213, 0.85)';

      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw viewport rectangle
    const extent = cy.extent();
    const vpX1 = toMiniX(extent.x1);
    const vpY1 = toMiniY(extent.y1);
    const vpX2 = toMiniX(extent.x2);
    const vpY2 = toMiniY(extent.y2);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vpX1, vpY1, vpX2 - vpX1, vpY2 - vpY1);
  }
}
