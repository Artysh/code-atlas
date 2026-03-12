import type { GraphRenderer } from '../graph/renderer';

export class Search {
  private overlay: HTMLElement;
  private input: HTMLInputElement;
  private resultsDiv: HTMLElement;
  private countSpan: HTMLElement;
  private results: cytoscape.NodeSingular[] = [];
  private currentIndex = -1;

  constructor(private renderer: GraphRenderer) {
    this.overlay = document.getElementById('search-overlay')!;
    this.input = document.getElementById('search-input') as HTMLInputElement;
    this.resultsDiv = document.getElementById('search-results')!;
    this.countSpan = document.getElementById('search-result-count')!;

    const btnSearch = document.getElementById('btn-search');
    const btnClose = document.getElementById('search-close')!;
    const btnPrev = document.getElementById('search-prev')!;
    const btnNext = document.getElementById('search-next')!;

    btnSearch?.addEventListener('click', () => this.toggle());
    btnClose.addEventListener('click', () => this.close());
    btnPrev.addEventListener('click', () => this.navigateResult(-1));
    btnNext.addEventListener('click', () => this.navigateResult(1));

    this.input.addEventListener('input', () => this.performSearch());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.navigateResult(e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        this.open();
      }
    });
  }

  toggle(): void {
    if (this.overlay.classList.contains('hidden')) {
      this.open();
    } else {
      this.close();
    }
  }

  open(): void {
    this.overlay.classList.remove('hidden');
    this.input.focus();
    this.input.select();
  }

  close(): void {
    this.overlay.classList.add('hidden');
    this.input.value = '';
    this.results = [];
    this.currentIndex = -1;
    this.countSpan.textContent = '';
    this.resultsDiv.innerHTML = '';
    this.renderer.clearHighlight();
  }

  private performSearch(): void {
    const query = this.input.value.trim();
    if (!query) {
      this.results = [];
      this.currentIndex = -1;
      this.countSpan.textContent = '';
      this.resultsDiv.innerHTML = '';
      this.renderer.clearHighlight();
      return;
    }

    const matched = this.renderer.searchNodes(query);
    this.results = [];
    matched.forEach(n => { this.results.push(n); });
    this.currentIndex = this.results.length > 0 ? 0 : -1;

    this.countSpan.textContent = `${this.results.length} found`;

    this.resultsDiv.innerHTML = '';
    for (let i = 0; i < Math.min(this.results.length, 50); i++) {
      const node = this.results[i];
      const item = document.createElement('div');
      item.className = 'search-result-item';
      if (i === this.currentIndex) { item.classList.add('active'); }

      const label = node.data('label') || '';
      const type = node.data('type') || '';
      item.innerHTML = `<span class="result-label">${label}</span> <span class="result-type">${type}</span>`;

      item.addEventListener('click', () => {
        this.currentIndex = i;
        this.focusCurrent();
        this.updateActiveResult();
      });

      this.resultsDiv.appendChild(item);
    }

    if (this.currentIndex >= 0) {
      this.focusCurrent();
    }

    this.renderer.highlightNodes(this.results.map(n => n.id()));
  }

  private navigateResult(direction: number): void {
    if (this.results.length === 0) { return; }
    this.currentIndex = (this.currentIndex + direction + this.results.length) % this.results.length;
    this.focusCurrent();
    this.updateActiveResult();
  }

  private focusCurrent(): void {
    if (this.currentIndex < 0 || this.currentIndex >= this.results.length) { return; }
    const node = this.results[this.currentIndex];
    this.renderer.getCy().animate({
      center: { eles: node },
      duration: 200,
    });
  }

  private updateActiveResult(): void {
    const items = this.resultsDiv.querySelectorAll('.search-result-item');
    items.forEach((item, i) => {
      item.classList.toggle('active', i === this.currentIndex);
    });
  }
}
