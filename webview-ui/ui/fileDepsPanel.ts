import type { GraphRenderer } from '../graph/renderer';
import type { FileDeps } from '../../src/types';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

export class FileDepsPanel {
  private container: HTMLElement;
  private currentDeps: FileDeps | null = null;

  constructor(private renderer: GraphRenderer, private vscode: VsCodeApi) {
    this.container = document.getElementById('file-deps-content')!;
  }

  setFileDeps(deps: FileDeps): void {
    this.currentDeps = deps;
    this.render();
  }

  clear(): void {
    this.currentDeps = null;
    this.container.innerHTML = '<p class="panel-empty">Click a node to see its dependencies.</p>';
  }

  private render(): void {
    if (!this.currentDeps) { return; }
    const deps = this.currentDeps;
    this.container.innerHTML = '';

    // File name header
    const header = document.createElement('div');
    header.className = 'fdp-header';
    header.innerHTML = `<span class="fdp-filename">${this.escapeHtml(deps.fileName)}</span>`;
    header.addEventListener('click', () => {
      this.vscode.postMessage({ command: 'openFile', filePath: deps.filePath });
    });
    this.container.appendChild(header);

    // Imports section
    if (deps.imports.length > 0) {
      this.renderSection('Imports', deps.imports, 'fdp-import', (imp) => {
        this.renderer.highlightNodes([deps.filePath, imp.filePath]);
      });
    }

    // Imported By section
    if (deps.importedBy.length > 0) {
      this.renderSection('Imported By', deps.importedBy, 'fdp-imported-by', (imp) => {
        this.renderer.highlightNodes([deps.filePath, imp.filePath]);
      });
    }

    // Symbols section
    if (deps.symbols.length > 0) {
      const section = document.createElement('div');
      section.className = 'fdp-section';
      section.innerHTML = `<div class="fdp-section-title">Symbols <span class="fdp-count">${deps.symbols.length}</span></div>`;

      for (const sym of deps.symbols) {
        const item = document.createElement('div');
        item.className = 'fdp-item';
        let html = `<span class="fdp-badge fdp-badge-${sym.type}">${sym.type}</span>`;
        html += `<span class="fdp-name">${this.escapeHtml(sym.name)}</span>`;
        if (sym.calls.length > 0) {
          html += `<span class="fdp-calls">${sym.calls.length} call${sym.calls.length > 1 ? 's' : ''}</span>`;
        }
        item.innerHTML = html;
        section.appendChild(item);
      }

      this.container.appendChild(section);
    }

    if (deps.imports.length === 0 && deps.importedBy.length === 0 && deps.symbols.length === 0) {
      this.container.innerHTML += '<p class="panel-empty">No dependencies found.</p>';
    }
  }

  private renderSection(
    title: string,
    items: { filePath: string; fileName: string; symbols: string[] }[],
    className: string,
    onClick: (item: { filePath: string; fileName: string; symbols: string[] }) => void,
  ): void {
    const section = document.createElement('div');
    section.className = 'fdp-section';
    section.innerHTML = `<div class="fdp-section-title">${title} <span class="fdp-count">${items.length}</span></div>`;

    for (const item of items) {
      const row = document.createElement('div');
      row.className = `fdp-item ${className}`;
      row.title = item.filePath;

      let html = `<span class="fdp-name">${this.escapeHtml(item.fileName)}</span>`;
      if (item.symbols.length > 0) {
        const display = item.symbols.length <= 3
          ? item.symbols.join(', ')
          : `${item.symbols.slice(0, 2).join(', ')} +${item.symbols.length - 2}`;
        html += `<span class="fdp-symbols">${this.escapeHtml(display)}</span>`;
      }
      row.innerHTML = html;

      row.addEventListener('click', () => onClick(item));
      section.appendChild(row);
    }

    this.container.appendChild(section);
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
