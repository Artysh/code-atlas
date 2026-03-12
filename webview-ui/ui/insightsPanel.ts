import type { GraphRenderer } from '../graph/renderer';
import type { Insight } from '../../src/types';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

const SEVERITY_ICONS: Record<string, string> = {
  error: '!',
  warning: '?',
  info: 'i',
};

const TYPE_LABELS: Record<string, string> = {
  circularDependency: 'Circular Dependencies',
  highCoupling: 'High Coupling',
  orphanedFile: 'Orphaned Files',
  hotspot: 'Dependency Hotspots',
  architecturalViolation: 'Violations',
};

export class InsightsPanel {
  private container: HTMLElement;
  private insights: Insight[] = [];

  constructor(private renderer: GraphRenderer, private vscode: VsCodeApi) {
    this.container = document.getElementById('insights-list')!;
  }

  setInsights(insights: Insight[]): void {
    this.insights = insights;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = '';

    if (this.insights.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'insights-empty';
      emptyMsg.textContent = 'No issues detected.';
      this.container.appendChild(emptyMsg);
      return;
    }

    // Group insights by type
    const grouped = new Map<string, Insight[]>();
    for (const insight of this.insights) {
      const group = grouped.get(insight.type) || [];
      group.push(insight);
      grouped.set(insight.type, group);
    }

    for (const [type, items] of grouped) {
      const section = document.createElement('div');
      section.className = 'insight-section';

      const header = document.createElement('div');
      header.className = 'insight-section-header';
      header.innerHTML = `
        <span class="insight-section-title">${TYPE_LABELS[type] || type}</span>
        <span class="insight-section-count">${items.length}</span>
      `;
      header.addEventListener('click', () => {
        section.classList.toggle('collapsed');
      });
      section.appendChild(header);

      const list = document.createElement('div');
      list.className = 'insight-section-body';

      for (const insight of items) {
        const item = document.createElement('div');
        item.className = `insight-item insight-${insight.severity}`;

        const icon = document.createElement('span');
        icon.className = `insight-icon insight-icon-${insight.severity}`;
        icon.textContent = SEVERITY_ICONS[insight.severity] || 'i';

        const content = document.createElement('div');
        content.className = 'insight-content';

        const title = document.createElement('div');
        title.className = 'insight-title';
        title.textContent = insight.title;

        const desc = document.createElement('div');
        desc.className = 'insight-description';
        desc.textContent = insight.description;

        content.appendChild(title);
        content.appendChild(desc);
        item.appendChild(icon);
        item.appendChild(content);

        item.addEventListener('click', () => {
          this.renderer.highlightNodes(insight.affectedNodes);
        });

        list.appendChild(item);
      }

      section.appendChild(list);
      this.container.appendChild(section);
    }
  }
}
