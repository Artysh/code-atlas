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
  k8sResource: 'K8s Resources',
  argoResource: 'Argo Resources',
  helmChart: 'Helm Charts',
  namespace: 'Namespaces',
};

const TYPE_COLORS: Record<string, string> = {
  file: '#5B9BD5', class: '#E5C07B', function: '#C678DD', component: '#56B6C2',
  route: '#E06C75', module: '#3D5A80', interface: '#98C379', enum: '#D19A66', variable: '#61AFEF',
  k8sResource: '#326CE5', argoResource: '#EF7B4D', helmChart: '#0F1689', namespace: '#6B7280',
};

export class Filters {
  private popup: HTMLElement;
  private visibleTypes = new Set<string>();
  private visibleGroups = new Set<string>();
  private allTypes: string[] = [];
  private allGroups: string[] = [];
  private typeCounts = new Map<string, number>();
  private groupCounts = new Map<string, number>();

  constructor(private renderer: GraphRenderer, private vscode: VsCodeApi) {
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
    const cy = this.renderer.getCy();

    this.typeCounts.clear();
    this.groupCounts.clear();
    const typeSet = new Set<string>();
    const groupSet = new Set<string>();

    cy.nodes().forEach(node => {
      const t = node.data('type');
      if (!t) { return; }
      if (node.isParent()) {
        groupSet.add(t);
        this.groupCounts.set(t, (this.groupCounts.get(t) || 0) + 1);
      } else {
        typeSet.add(t);
        this.typeCounts.set(t, (this.typeCounts.get(t) || 0) + 1);
      }
    });

    this.allTypes = Array.from(typeSet).sort();
    this.allGroups = Array.from(groupSet).sort();
    this.visibleTypes = new Set(this.allTypes);
    this.visibleGroups = new Set(this.allGroups);
    this.renderPopup();
  }

  private togglePopup(anchor: HTMLElement): void {
    if (!this.popup.classList.contains('hidden')) {
      this.popup.classList.add('hidden');
      return;
    }

    this.renderPopup();
    this.popup.classList.remove('hidden');

    const rect = anchor.getBoundingClientRect();
    this.popup.style.left = `${rect.left}px`;
    this.popup.style.top = `${rect.bottom + 4}px`;
  }

  private renderPopup(): void {
    this.popup.innerHTML = '';

    if (this.allGroups.length > 0) {
      const groupHeader = document.createElement('div');
      groupHeader.className = 'fp-header';
      groupHeader.innerHTML = `<span>Groups (Boxes)</span>`;
      const toggleAllGroups = document.createElement('button');
      toggleAllGroups.className = 'fp-toggle-all';
      const allGroupsVisible = this.allGroups.every(g => this.visibleGroups.has(g));
      toggleAllGroups.textContent = allGroupsVisible ? 'Hide All' : 'Show All';
      toggleAllGroups.addEventListener('click', () => {
        if (allGroupsVisible) {
          for (const g of this.allGroups) { this.visibleGroups.delete(g); }
        } else {
          for (const g of this.allGroups) { this.visibleGroups.add(g); }
        }
        this.renderer.filterGroups(this.visibleGroups);
        this.renderPopup();
      });
      groupHeader.appendChild(toggleAllGroups);
      this.popup.appendChild(groupHeader);

      for (const group of this.allGroups) {
        const row = document.createElement('label');
        row.className = 'fp-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = this.visibleGroups.has(group);
        cb.addEventListener('change', () => {
          if (cb.checked) { this.visibleGroups.add(group); }
          else { this.visibleGroups.delete(group); }
          this.renderer.filterGroups(this.visibleGroups);
          this.renderPopup();
        });

        const dot = document.createElement('span');
        dot.className = 'fp-dot';
        dot.style.background = TYPE_COLORS[group] || '#888';

        const label = document.createElement('span');
        label.className = 'fp-label';
        label.textContent = (TYPE_LABELS[group] || group);

        const count = document.createElement('span');
        count.className = 'fp-count';
        count.textContent = String(this.groupCounts.get(group) || 0);

        row.appendChild(cb);
        row.appendChild(dot);
        row.appendChild(label);
        row.appendChild(count);
        this.popup.appendChild(row);
      }

      const divider = document.createElement('div');
      divider.className = 'fp-divider';
      this.popup.appendChild(divider);
    }

    const typeHeader = document.createElement('div');
    typeHeader.className = 'fp-header';
    typeHeader.innerHTML = `<span>Node Types</span>`;
    const toggleAllTypes = document.createElement('button');
    toggleAllTypes.className = 'fp-toggle-all';
    const allTypesVisible = this.allTypes.every(t => this.visibleTypes.has(t));
    toggleAllTypes.textContent = allTypesVisible ? 'Hide All' : 'Show All';
    toggleAllTypes.addEventListener('click', () => {
      if (allTypesVisible) {
        this.visibleTypes.clear();
      } else {
        this.visibleTypes = new Set(this.allTypes);
      }
      this.renderer.filterByType(this.visibleTypes);
      this.renderPopup();
    });
    typeHeader.appendChild(toggleAllTypes);
    this.popup.appendChild(typeHeader);

    for (const type of this.allTypes) {
      const row = document.createElement('label');
      row.className = 'fp-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = this.visibleTypes.has(type);
      cb.addEventListener('change', () => {
        if (cb.checked) { this.visibleTypes.add(type); }
        else { this.visibleTypes.delete(type); }
        this.renderer.filterByType(this.visibleTypes);
        this.renderPopup();
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
        this.renderPopup();
      });
      this.popup.appendChild(showHiddenBtn);
    }
  }
}
