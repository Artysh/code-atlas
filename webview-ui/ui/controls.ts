import type { GraphRenderer } from '../graph/renderer';
import type { ViewType, LayoutType } from '../../src/types';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

export class Controls {
  private viewSelector: HTMLSelectElement;
  private layoutSelector: HTMLSelectElement;
  private _suppressViewChange = false;

  constructor(private renderer: GraphRenderer, private vscode: VsCodeApi) {
    this.viewSelector = document.getElementById('view-selector') as HTMLSelectElement;
    this.layoutSelector = document.getElementById('layout-selector') as HTMLSelectElement;

    const btnZoomIn = document.getElementById('btn-zoom-in')!;
    const btnZoomOut = document.getElementById('btn-zoom-out')!;
    const btnFit = document.getElementById('btn-fit')!;
    const btnRefresh = document.getElementById('btn-refresh')!;
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar')!;
    const sidebar = document.getElementById('sidebar')!;

    this.viewSelector.addEventListener('change', () => {
      if (this._suppressViewChange) { return; }
      const view = this.viewSelector.value as ViewType;
      this.vscode.postMessage({ command: 'changeView', view });
    });

    this.layoutSelector.addEventListener('change', () => {
      const layout = this.layoutSelector.value as LayoutType;
      this.renderer.applyLayout(layout);
    });

    btnZoomIn.addEventListener('click', () => this.renderer.zoomIn());
    btnZoomOut.addEventListener('click', () => this.renderer.zoomOut());
    btnFit.addEventListener('click', () => this.renderer.fitView());

    btnRefresh.addEventListener('click', () => {
      this.vscode.postMessage({ command: 'requestRefresh' });
    });

    btnToggleSidebar.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
      setTimeout(() => this.renderer.getCy().resize(), 100);
    });
  }

  setActiveView(view: ViewType): void {
    this._suppressViewChange = true;
    this.viewSelector.value = view;
    this._suppressViewChange = false;
  }
}
