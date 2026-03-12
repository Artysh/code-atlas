---
name: UI polish and minimap
overview: Fix the minimap to support drag-to-pan and show proper colored nodes; add a layout direction toggle (TB/LR); improve node labels, edge routing, overflow handling, and overall visual polish across CSS, renderer, and HTML.
todos:
  - id: minimap-rewrite
    content: "Rewrite minimap.ts: add drag-to-pan, colored nodes by type, larger dots, ResizeObserver, layoutstop listener"
    status: completed
  - id: layout-direction
    content: Add dagreLR layout type to types.ts, renderer.ts layout options, and HTML select
    status: completed
  - id: edge-labels-routing
    content: Add edge labels and change curve-style to taxi in renderer.ts stylesheet
    status: completed
  - id: node-shadows
    content: Add shadow and fix text-max-width overflow in renderer.ts node styles
    status: completed
  - id: css-polish
    content: "CSS: bigger grid, legend wrap, toolbar scrollbar hide, minimap resize, sidebar overflow fix"
    status: completed
  - id: build-verify
    content: Build and verify zero TypeScript errors
    status: completed
isProject: false
---

# UI Polish, Minimap Fix, and Layout Direction Toggle

## Problem Summary

1. **Minimap is broken**: Only handles `click`, not drag. Nodes render as uniform blue 2px dots (no per-type colors). The viewport rectangle uses the wrong coordinate space (`cy.extent()` maps to what's visible, not the full graph bounding box), so it doesn't correctly represent the viewport.
2. **No horizontal layout option**: dagre is hardcoded `rankDir: 'TB'`. No way to switch between top-to-bottom and left-to-right.
3. **Visual clutter and overflow**: Node labels can still overflow if the label-length heuristic (`label.length * 9`) underestimates. Edge labels are stored but never shown. Filter/sidebar panels can overflow on small viewports. Legend wraps awkwardly.
4. **Aesthetics**: Edges use simple `bezier` which creates overlapping curved lines. No edge labels visible. Nodes have no shadow/depth. The grid background dots are barely visible.

---

## Changes

### 1. Minimap rewrite — [webview-ui/ui/minimap.ts](webview-ui/ui/minimap.ts)

- **Drag-to-pan**: Replace the single `click` listener with `mousedown` + `mousemove` + `mouseup` handling. On drag, continuously update `cy.pan()` based on delta movement mapped to graph coordinates.
- **Colored nodes**: Read `node.data('type')` and look up the same `NODE_COLORS` map (import or duplicate) to draw each dot in its correct color instead of a uniform blue.
- **Larger dots**: Increase dot radius from `2` to `3` for visibility.
- **Fix viewport rectangle**: The current code maps `cy.extent()` through `toMiniX/Y` which uses the *node bounding box* as the coordinate base. This is actually correct for showing the viewport relative to all nodes, but the issue is that `cy.extent()` returns the visible model region, so the viewport rect should be computed differently: use the *full graph bounding box* (`bb`) as the reference frame, and map the viewport (`cy.extent()`) coordinates relative to it. The current code does this but uses the same `bb` for both the nodes and the viewport — which should work. The real bug is likely that after layout animation completes, the graph extent changes but `update()` is not called. Fix: also listen to `layoutstop` event and call `scheduleUpdate()`.
- **Canvas resize**: Use a `ResizeObserver` on the container to keep canvas dimensions in sync.

### 2. Layout direction toggle — multiple files

**[src/types.ts](src/types.ts):**

- Add `'dagreLR'` to `LayoutType`: `export type LayoutType = 'dagre' | 'dagreLR' | 'cose' | 'breadthfirst' | 'grid' | 'circle';`

**[webview-ui/graph/renderer.ts](webview-ui/graph/renderer.ts) — `applyLayout()`:**

- Add a `dagreLR` entry in `layoutOptions` identical to `dagre` but with `rankDir: 'LR'`.

**[src/webview/contentProvider.ts](src/webview/contentProvider.ts) — HTML:**

- Add `<option value="dagreLR">Horizontal (L-R)</option>` to `#layout-selector`.

### 3. Edge labels and routing — [webview-ui/graph/renderer.ts](webview-ui/graph/renderer.ts)

In the `getStylesheet()` edge selector:

- Add `'label': 'data(label)'` to show edge labels (e.g., imported symbol names).
- Add `'font-size': 10`, `'text-rotation': 'autorotate'`, `'color': '#888'`, `'text-background-color': '#1E1E1E'`, `'text-background-opacity': 0.8`, `'text-background-padding': '2px'` so labels are readable on edges.
- Change `'curve-style'` from `'bezier'` to `'taxi'` for orthogonal (right-angle) routing, which is cleaner for architecture diagrams. Set `'taxi-direction': 'downward'` for TB layouts.

### 4. Node styling improvements — [webview-ui/graph/renderer.ts](webview-ui/graph/renderer.ts)

In the `getStylesheet()` node selector:

- Add a subtle shadow effect: `'shadow-blur': 8`, `'shadow-color': 'rgba(0,0,0,0.3)'`, `'shadow-offset-x': 0`, `'shadow-offset-y': 2`, `'shadow-opacity': 0.6`.
- Increase `'border-opacity'` from `0.9` to `1`.
- Change `'text-max-width'` to be relative to actual node width so it never overflows: use `(ele) => String(Math.max(label.length * 9, 68)) + 'px'` (slightly smaller than the node width).

### 5. CSS polish — [webview-ui/styles/main.css](webview-ui/styles/main.css)

- **Graph grid**: Change the dot grid `background-size` from `24px` to `32px` and increase dot opacity from `0.04` to `0.06` for a more visible but still subtle grid.
- **Legend**: Set `flex-wrap: wrap` on `#legend` and add `max-width: calc(100% - 240px)` to prevent it pushing off-screen when minimap is visible (minimap is 200px wide on the left).
- **Sidebar overflow**: Add `min-height: 0` to `#filters-panel` so it can shrink and doesn't force the sidebar to overflow.
- **Filter items**: Add `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` to filter item labels.
- **Toolbar**: Add `scrollbar-width: none` and `::-webkit-scrollbar { display: none }` to `#toolbar` so horizontal overflow scrolls cleanly without a visible scrollbar.
- **Minimap**: Update dimensions from `200x130` to `220x150` for more room. Add `backdrop-filter: blur(4px)` for a modern frosted-glass effect.
- **File deps panel**: Add `scrollbar-width: thin` for a cleaner scrollbar.

### 6. Toolbar layout direction label — [src/webview/contentProvider.ts](src/webview/contentProvider.ts)

Rename the existing "Hierarchical" option to "Top to Bottom" and add "Left to Right":

```html
<option value="dagre">Top to Bottom</option>
<option value="dagreLR">Left to Right</option>
<option value="cose">Force-Directed</option>
...
```

---

## Files changed (6 total)

- `src/types.ts` — add `'dagreLR'` to LayoutType
- `src/webview/contentProvider.ts` — add layout option in HTML
- `webview-ui/graph/renderer.ts` — edge labels, taxi routing, node shadows, dagreLR layout
- `webview-ui/ui/minimap.ts` — drag support, colored nodes, ResizeObserver, layoutstop listener
- `webview-ui/styles/main.css` — grid, legend, sidebar, toolbar, minimap visual polish
- `webview-ui/ui/filters.ts` — no code changes needed (CSS handles overflow)

