import * as vscode from 'vscode';

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css'),
  );
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      script-src 'nonce-${nonce}';
      img-src ${webview.cspSource} data: blob:;
      font-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>Code Atlas</title>
</head>
<body>
  <div id="app">

    <!-- ===== TOOLBAR ===== -->
    <header id="toolbar">
      <div class="toolbar-section toolbar-left">
        <div class="toolbar-group" id="folder-selector-group">
          <div class="select-with-icon">
            <svg class="select-icon" width="14" height="14" viewBox="0 0 16 16"><path d="M1.5 2.5h4l1.5 1.5H14a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5v-10z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
            <select id="folder-selector" title="Select workspace folder"></select>
          </div>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <div class="select-with-icon">
            <svg class="select-icon" width="14" height="14" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>
            <select id="view-selector" title="Select view">
              <option value="architecture">Architecture Map</option>
              <option value="dependency">Dependency Graph</option>
              <option value="callGraph">Call Graph</option>
              <option value="componentTree">Component Tree</option>
              <option value="routeMap">Route Map</option>
              <option value="userFlow">User Flow</option>
              <option value="k8sMap">Kubernetes Map</option>
              <option value="argoMap">Argo Map</option>
            </select>
          </div>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <div class="select-with-icon">
            <svg class="select-icon" width="14" height="14" viewBox="0 0 16 16"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
            <select id="layout-selector" title="Layout algorithm">
              <option value="dagre">Top to Bottom</option>
              <option value="dagreLR">Left to Right</option>
              <option value="grid">Grid</option>
              <option value="circle">Circle</option>
            </select>
          </div>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group toolbar-actions">
          <button id="btn-filter" class="tb tb-icon-label" title="Show/hide node types">
            <svg width="14" height="14" viewBox="0 0 16 16"><path d="M1 3h14L9 9v4l-2 1V9z" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round"/></svg>
            <span>Filter</span>
          </button>
          <button id="btn-toggle-sidebar" class="tb tb-icon-label" title="Toggle insights panel">
            <svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="5" r="1.5" fill="currentColor"/><path d="M8 8v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
            <span>Insights</span>
          </button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group toolbar-actions">
          <button id="btn-zoom-in" class="tb" title="Zoom in">
            <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M7 5v4M5 7h4" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M10.8 10.8L14 14" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
          </button>
          <button id="btn-zoom-out" class="tb" title="Zoom out">
            <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M5 7h4" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M10.8 10.8L14 14" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
          </button>
          <button id="btn-fit" class="tb" title="Fit to view">
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>
          </button>
          <button id="btn-refresh" class="tb" title="Refresh">
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M10 2.5L8 5l3 0z" fill="currentColor"/></svg>
          </button>
          <button id="btn-export" class="tb" title="Export">
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2v8M4.5 7L8 10.5 11.5 7" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 13h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </header>

    <!-- ===== MAIN CONTENT ===== -->
    <div id="main-content">
      <div id="graph-wrapper">
        <div id="graph-container"></div>

        <!-- Bottom bar: stats breakdown + dynamic legend -->
        <div id="bottom-bar">
          <div id="graph-stats"></div>
          <div class="bottom-bar-divider" id="stats-legend-divider"></div>
          <div id="legend"></div>
        </div>

        <!-- Minimap (bottom-right floating) -->
        <div id="minimap"></div>
      </div>

      <!-- ===== SIDEBAR ===== -->
      <aside id="sidebar" class="hidden">
        <section id="file-deps-panel">
          <h3 class="panel-heading">File Dependencies</h3>
          <div id="file-deps-content">
            <p class="panel-empty">Click a node to see its dependencies.</p>
          </div>
        </section>
        <section id="insights-panel">
          <h3 class="panel-heading">Insights</h3>
          <div id="insights-list"></div>
        </section>
      </aside>
    </div>

    <!-- ===== SEARCH OVERLAY ===== -->
    <div id="search-overlay" class="hidden">
      <div id="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
        <input type="text" id="search-input" placeholder="Search nodes..." autocomplete="off" spellcheck="false" />
        <span id="search-result-count"></span>
        <button id="search-prev" class="tb small" title="Previous">&lsaquo;</button>
        <button id="search-next" class="tb small" title="Next">&rsaquo;</button>
        <button id="search-close" class="tb small" title="Close">&times;</button>
      </div>
      <div id="search-results"></div>
    </div>

    <!-- ===== LOADING ===== -->
    <div id="loading" class="hidden">
      <div class="spinner"></div>
      <span class="loading-text">Analyzing codebase...</span>
    </div>

    <!-- ===== POPUPS ===== -->
    <div id="tooltip" class="hidden"></div>
    <div id="context-menu" class="hidden"></div>
    <div id="filter-popup" class="hidden"></div>
    <div id="export-menu" class="hidden">
      <button class="popup-item" data-format="png">Export as PNG</button>
      <button class="popup-item" data-format="svg">Export as SVG</button>
      <button class="popup-item" data-format="json">Export as JSON</button>
      <button class="popup-item" data-format="drawio">Export as Draw.io</button>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
