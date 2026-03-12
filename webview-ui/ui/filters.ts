import type { GraphRenderer } from '../graph/renderer';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

const TYPE_LABELS: Record<string, string> = {
  file: 'Files',
  class: 'Classes',
  function: 'Functions',
  component: 'Components',
  route: 'Routes',
  module: 'Modules',
  interface: 'Interfaces',
  enum: 'Enums',
  variable: 'Variables',
};

export class Filters {
  private container: HTMLElement;
  private visibleTypes = new Set<string>();

  constructor(private renderer: GraphRenderer, private vscode: VsCodeApi) {
    this.container = document.getElementById('filter-checkboxes')!;
  }

  refresh(): void {
    const types = this.renderer.getNodeTypes();
    this.visibleTypes = new Set(types);
    this.render(types);
  }

  private render(types: string[]): void {
    this.container.innerHTML = '';

    for (const type of types) {
      const label = document.createElement('label');
      label.className = 'filter-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.visibleTypes.has(type);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.visibleTypes.add(type);
        } else {
          this.visibleTypes.delete(type);
        }
        this.renderer.filterByType(this.visibleTypes);
      });

      const colorDot = document.createElement('span');
      colorDot.className = `filter-dot filter-dot-${type}`;

      const text = document.createElement('span');
      text.textContent = TYPE_LABELS[type] || type;

      label.appendChild(checkbox);
      label.appendChild(colorDot);
      label.appendChild(text);
      this.container.appendChild(label);
    }
  }
}
