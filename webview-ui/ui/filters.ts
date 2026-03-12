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

const TYPE_COLORS: Record<string, string> = {
  file: '#5B9BD5', class: '#E5C07B', function: '#C678DD', component: '#56B6C2',
  route: '#E06C75', module: '#3D5A80', interface: '#98C379', enum: '#D19A66', variable: '#61AFEF',
};

export class Filters {
  private sidebarContainer: HTMLElement;
  private popup: HTMLElement;
  private visibleTypes = new Set<string>();
  private allTypes: string[] = [];
  private typeCounts = new Map<string, number>();

  constructor(private renderer: GraphRenderer, private vscode: VsCodeApi) {
    this.sidebarContainer = document.getElementById('filter-checkboxes')!;
    this.popup = document.getElementById('filter-popup')!;

    const btnFilter = document.getElementById('btn-filter')!;
    btnFilter.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePopup(btnFilter);
    });

    document.addEventListener('click', (e) => {
      if (!this.popup.contains(e.target as Node)) {
        this.popup.classList.add('hidden');
      }
    });

    this.popup.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  refresh(): void {
    const types = this.renderer.getNodeTypes();
    this.allTypes = types;
    this.visibleTypes = new Set(types);

    this.typeCounts.clear();
    const cy = this.renderer.getCy();
    cy.nodes().forEach(node => {
      if (node.isChild()) { return; }
      const t = node.data('type');
      if (t) { this.typeCounts.set(t, (this.typeCounts.get(t) || 0) + 1); }
    });

    this.renderSidebar(types);
    this.renderPopup(types);
  }

  private togglePopup(anchor: HTMLElement): void {
    if (!this.popup.classList.contains('hidden')) {
      this.popup.classList.add('hidden');
      return;
    }

    this.renderPopup(this.allTypes);
    this.popup.classList.remove('hidden');

    const rect = anchor.getBoundingClientRect();
    this.popup.style.left = `${rect.left}px`;
    this.popup.style.top = `${rect.bottom + 4}px`;
  }

  private renderPopup(types: string[]): void {
    this.popup.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'fp-header';
    header.innerHTML = `<span>Filter by Type</span>`;

    const toggleAll = document.createElement('button');
    toggleAll.className = 'fp-toggle-all';
    const allVisible = types.every(t => this.visibleTypes.has(t));
    toggleAll.textContent = allVisible ? 'Hide All' : 'Show All';
    toggleAll.addEventListener('click', () => {
      if (allVisible) {
        this.visibleTypes.clear();
      } else {
        this.visibleTypes = new Set(types);
      }
      this.renderer.filterByType(this.visibleTypes);
      this.renderPopup(types);
      this.renderSidebar(types);
    });
    header.appendChild(toggleAll);
    this.popup.appendChild(header);

    for (const type of types) {
      const row = document.createElement('label');
      row.className = 'fp-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = this.visibleTypes.has(type);
      cb.addEventListener('change', () => {
        if (cb.checked) { this.visibleTypes.add(type); }
        else { this.visibleTypes.delete(type); }
        this.renderer.filterByType(this.visibleTypes);
        this.renderSidebar(types);
      });

      const dot = document.createElement('span');
      dot.className = 'fp-dot';
      dot.style.background = TYPE_COLORS[type] || '#888';

      const label = document.createElement('span');
      label.className = 'fp-label';
      label.textContent = TYPE_LABELS[type] || type;

      const count = document.createElement('span');
      count.className = 'fp-count';
      count.textContent = String(this.typeCounts.get(type) || 0);

      row.appendChild(cb);
      row.appendChild(dot);
      row.appendChild(label);
      row.appendChild(count);
      this.popup.appendChild(row);
    }

    const hiddenCount = this.renderer.getHiddenCount();
    if (hiddenCount > 0) {
      const divider = document.createElement('div');
      divider.className = 'fp-divider';
      this.popup.appendChild(divider);

      const showHiddenBtn = document.createElement('button');
      showHiddenBtn.className = 'fp-show-hidden';
      showHiddenBtn.textContent = `Show Hidden (${hiddenCount})`;
      showHiddenBtn.addEventListener('click', () => {
        this.renderer.showAllHidden();
        this.renderPopup(types);
        this.renderSidebar(types);
      });
      this.popup.appendChild(showHiddenBtn);
    }
  }

  private renderSidebar(types: string[]): void {
    this.sidebarContainer.innerHTML = '';

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
        this.renderPopup(types);
      });

      const colorDot = document.createElement('span');
      colorDot.className = `filter-dot filter-dot-${type}`;

      const text = document.createElement('span');
      text.textContent = TYPE_LABELS[type] || type;

      label.appendChild(checkbox);
      label.appendChild(colorDot);
      label.appendChild(text);
      this.sidebarContainer.appendChild(label);
    }
  }
}
