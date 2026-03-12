import type { GraphRenderer } from '../graph/renderer';

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

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private dragging = false;

  constructor(private container: HTMLElement, private renderer: GraphRenderer) {
    this.canvas = document.createElement('canvas');
    this.syncCanvasSize();
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    const cy = renderer.getCy();

    // Drag-to-pan: mousedown starts, mousemove pans, mouseup/mouseleave stops
    this.canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.dragging = true;
      this.panToCanvasPoint(e);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.dragging) { return; }
      e.preventDefault();
      this.panToCanvasPoint(e);
    });

    this.canvas.addEventListener('mouseup', () => { this.dragging = false; });
    this.canvas.addEventListener('mouseleave', () => { this.dragging = false; });

    // Also handle simple clicks (mousedown+mouseup without move)
    this.canvas.addEventListener('click', (e) => {
      this.panToCanvasPoint(e);
    });

    cy.on('pan zoom resize', () => this.scheduleUpdate());
    cy.on('layoutstop', () => this.scheduleUpdate());

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        this.syncCanvasSize();
        this.scheduleUpdate();
      });
      ro.observe(container);
    }
  }

  update(): void {
    this.draw();
  }

  private syncCanvasSize(): void {
    const w = this.container.clientWidth || 220;
    const h = this.container.clientHeight || 150;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private panToCanvasPoint(e: MouseEvent): void {
    const cy = this.renderer.getCy();
    const nodes = cy.nodes().filter(n => n.visible());
    if (nodes.length === 0) { return; }

    const bb = nodes.boundingBox();
    const graphWidth = bb.w || 1;
    const graphHeight = bb.h || 1;

    const rect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const padding = 12;

    const scaleX = (w - padding * 2) / graphWidth;
    const scaleY = (h - padding * 2) / graphHeight;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = padding + ((w - padding * 2) - graphWidth * scale) / 2;
    const offsetY = padding + ((h - padding * 2) - graphHeight * scale) / 2;

    const modelX = bb.x1 + (clickX - offsetX) / scale;
    const modelY = bb.y1 + (clickY - offsetY) / scale;

    cy.pan({
      x: cy.width() / 2 - modelX * cy.zoom(),
      y: cy.height() / 2 - modelY * cy.zoom(),
    });
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
    const padding = 12;

    const scaleX = (w - padding * 2) / graphWidth;
    const scaleY = (h - padding * 2) / graphHeight;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = padding + ((w - padding * 2) - graphWidth * scale) / 2;
    const offsetY = padding + ((h - padding * 2) - graphHeight * scale) / 2;

    const toMiniX = (x: number) => offsetX + (x - bb.x1) * scale;
    const toMiniY = (y: number) => offsetY + (y - bb.y1) * scale;

    // Edges
    ctx.strokeStyle = 'rgba(120, 120, 120, 0.25)';
    ctx.lineWidth = 0.5;
    cy.edges().filter(e => e.visible()).forEach(edge => {
      const srcPos = edge.source().position();
      const tgtPos = edge.target().position();
      ctx.beginPath();
      ctx.moveTo(toMiniX(srcPos.x), toMiniY(srcPos.y));
      ctx.lineTo(toMiniX(tgtPos.x), toMiniY(tgtPos.y));
      ctx.stroke();
    });

    // Nodes — colored by type
    nodes.forEach(node => {
      if (node.isParent()) { return; }
      const pos = node.position();
      const x = toMiniX(pos.x);
      const y = toMiniY(pos.y);

      if (node.hasClass('dimmed')) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.25)';
      } else {
        const type = node.data('type') as string;
        ctx.fillStyle = NODE_COLORS[type] || '#888';
        ctx.globalAlpha = 0.9;
      }

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Viewport rectangle
    const extent = cy.extent();
    const vpX1 = toMiniX(extent.x1);
    const vpY1 = toMiniY(extent.y1);
    const vpX2 = toMiniX(extent.x2);
    const vpY2 = toMiniY(extent.y2);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vpX1, vpY1, vpX2 - vpX1, vpY2 - vpY1);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(vpX1, vpY1, vpX2 - vpX1, vpY2 - vpY1);
  }
}
