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
      <div class="toolbar-section">
        <div class="toolbar-group">
          <select id="view-selector" title="Select view">
            <option value="architecture">Architecture Map</option>
            <option value="dependency">Dependency Graph</option>
            <option value="callGraph">Call Graph</option>
            <option value="componentTree">Component Tree</option>
            <option value="routeMap">Route Map</option>
            <option value="userFlow">User Flow</option>
          </select>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <select id="layout-selector" title="Layout algorithm">
            <option value="dagre">Top to Bottom</option>
            <option value="dagreLR">Left to Right</option>
            <option value="cose">Force-Directed</option>
            <option value="breadthfirst">Breadthfirst</option>
            <option value="grid">Grid</option>
            <option value="circle">Circle</option>
          </select>
        </div>
      </div>

      <div class="toolbar-section">
        <div class="toolbar-divider"></div>
        <button id="btn-zoom-in" class="tb" title="Zoom in">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>
        </button>
        <button id="btn-zoom-out" class="tb" title="Zoom out">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8h10" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>
        </button>
        <button id="btn-fit" class="tb" title="Fit to view">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>
        </button>
        <div class="toolbar-divider"></div>
        <button id="btn-search" class="tb" title="Search (Ctrl+F)">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>
        </button>
        <button id="btn-refresh" class="tb" title="Refresh analysis">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M10 2.5L8 5l3 0z" fill="currentColor"/></svg>
        </button>
        <button id="btn-export" class="tb" title="Export graph">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2v9M4.5 8L8 11.5 11.5 8M3 14h10" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>
        </button>
        <div class="toolbar-divider"></div>
        <button id="btn-toggle-sidebar" class="tb tb-label" title="Toggle insights panel">Insights</button>
      </div>

      <div class="toolbar-section toolbar-end">
        <span class="stats" id="node-count">0 nodes</span>
        <span class="stats-sep">/</span>
        <span class="stats" id="edge-count">0 edges</span>
      </div>
    </header>

    <!-- ===== MAIN CONTENT ===== -->
    <div id="main-content">
      <div id="graph-wrapper">
        <div id="graph-container"></div>
        <div id="minimap"></div>
        <!-- Legend -->
        <div id="legend">
          <div class="legend-item"><span class="legend-dot" style="background:#5B9BD5"></span>File</div>
          <div class="legend-item"><span class="legend-dot" style="background:#E5C07B"></span>Class</div>
          <div class="legend-item"><span class="legend-dot" style="background:#C678DD"></span>Function</div>
          <div class="legend-item"><span class="legend-dot" style="background:#56B6C2"></span>Component</div>
          <div class="legend-item"><span class="legend-dot" style="background:#E06C75"></span>Route</div>
          <div class="legend-item"><span class="legend-dot" style="background:#3D5A80"></span>Module</div>
        </div>
      </div>

      <!-- ===== SIDEBAR ===== -->
      <aside id="sidebar" class="hidden">
        <section id="filters-panel">
          <h3 class="panel-heading">Filters</h3>
          <div id="filter-checkboxes"></div>
        </section>
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
    <div id="export-menu" class="hidden">
      <button class="popup-item" data-format="png">Export as PNG</button>
      <button class="popup-item" data-format="svg">Export as SVG</button>
      <button class="popup-item" data-format="json">Export as JSON</button>
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
