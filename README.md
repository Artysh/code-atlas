<p align="center">
  <img src="./media/logo.png" alt="Code Atlas Logo" width="140">
</p>

<h1 align="center">Code Atlas</h1>
<h3 align="center">Open Source Architecture Visualization for VS Code & Cursor</h3>

<p align="center">
  <em>Dependency graphs, call graphs, component trees, route maps, Kubernetes resource maps, Argo/Helm visualizations, and architectural insights — all inside your IDE.</em>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License: MIT"/></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/></a>
  <a href="https://code.visualstudio.com/api"><img src="https://img.shields.io/badge/VS%20Code-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white" alt="VS Code"/></a>
</p>

<p align="center">
  <a href="https://js.cytoscape.org/"><img src="https://img.shields.io/badge/Cytoscape.js-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="Cytoscape.js"/></a>
  <a href="https://esbuild.github.io/"><img src="https://img.shields.io/badge/esbuild-FFCF00?style=flat-square&logo=esbuild&logoColor=black" alt="esbuild"/></a>
  <!-- <img src="https://img.shields.io/github/stars/code-atlas/code-atlas?style=flat-square" alt="GitHub Stars"/>
  <img src="https://img.shields.io/github/forks/code-atlas/code-atlas?style=flat-square" alt="GitHub Forks"/> -->
</p>

<br>

---

## 🌟 About

Code Atlas is an **open-source VS Code / Cursor extension** that turns your codebase into interactive, explorable architecture diagrams — without leaving your IDE. Whether you're onboarding onto a new project, untangling a monolith, or mapping out Kubernetes infrastructure, Code Atlas gives you the visual context you need.

**Built with ❤️ by developers, for developers.** We believe understanding a codebase shouldn't require weeks of reading code — that's why we built a tool that lets you see the entire picture at a glance.

### 🎯 Why Code Atlas?

<table>
<tr>
<td width="33%" align="center">
  <h3>🗺️ Full Architecture View</h3>
  <p>See every import, call, component, route, and K8s resource in one interactive graph.</p>
</td>
<td width="33%" align="center">
  <h3>☸️ Kubernetes & Argo</h3>
  <p>Auto-discovers K8s manifests, Helm charts, and Argo CD/Workflows/Rollouts/Events.</p>
</td>
<td width="33%" align="center">
  <h3>🔍 Deep Exploration</h3>
  <p>Focus mode, path tracing, reverse dependencies, and context menus for every node.</p>
</td>
</tr>
<tr>
<td width="33%" align="center">
  <h3>⚡ Incremental & Fast</h3>
  <p>File-watching cache re-parses only what changed — stays fast on large codebases.</p>
</td>
<td width="33%" align="center">
  <h3>📊 Architectural Insights</h3>
  <p>Detects circular dependencies, high coupling, orphans, and dependency hotspots.</p>
</td>
<td width="33%" align="center">
  <h3>🎨 IDE-Native UX</h3>
  <p>Theme-aware, keyboard-driven, with click-to-open, minimap, and export to PNG/SVG/Draw.io.</p>
</td>
</tr>
</table>

---

## 📑 Table of Contents

<table>
<tr>
<td width="50%" valign="top">

**Getting Started**
- [✨ Features](#features)
- [🖼️ Screenshots](#screenshots)
- [🚀 Quick Start](#quick-start)
- [⚙️ Configuration](#configuration)
- [🎹 Commands](#commands)

</td>
<td width="50%" valign="top">

**Documentation & Support**
- [🏗️ Architecture](#architecture)
- [🛠️ Development](#development)
- [🤝 Contributing](#contributing)
- [📄 License](#license)
- [🙏 Acknowledgments](#acknowledgments)

</td>
</tr>
</table>

---

## <a id="features"></a>✨ Features

### 🗺️ Code Analysis Views

| View | What it shows |
|------|---------------|
| **Architecture Map** | Combined view of all relationships — imports, calls, components, routes, and infrastructure |
| **Dependency Graph** | File-level import/export connections with directory grouping |
| **Call Graph** | Function and method call relationships across your codebase |
| **Component Tree** | React component render hierarchy |
| **Route Map** | Express, Next.js, and React Router routes with their handlers |
| **User Flow** | Entry-point-to-dependency chains (BFS traversal, 6 levels deep) |
| **Kubernetes Map** | K8s resources and their relationships — Deployments, Services, Ingresses, ConfigMaps, Secrets, and more |
| **Argo Map** | Argo CD Applications, Workflows, Rollouts, Events, and their connections |

### 🖱️ Interactive Graph
- **Navigate** — Zoom, pan, and drag nodes freely
- **Click-to-open** — Click any node to open the source file at the exact line
- **Focus mode** — Double-click to isolate a node and its connections
- **Context menu** — Right-click nodes for deeper exploration (dependencies, dependents, hide, trace path)
- **Search** — Fuzzy node search with `Ctrl/Cmd+F`
- **Filter** — Toggle node types on/off (files, classes, functions, components, K8s resources, Argo resources, namespaces)
- **Layouts** — Hierarchical top-to-bottom, left-to-right, grid, and circle layouts
- **Minimap** — Navigate large graphs with the minimap overlay
- **Export** — Save graphs as PNG, SVG, JSON, or Draw.io format

### ☸️ Kubernetes & Infrastructure
- **Resource discovery** — Automatically parses all YAML/YML files and detects Kubernetes manifests
- **Relationship mapping** — Traces connections between Deployments, Services, ConfigMaps, Secrets, Ingresses, PVCs, ServiceAccounts, RBAC, and more
- **Namespace grouping** — Resources are visually grouped by namespace
- **Phantom nodes** — Referenced resources that aren't defined in the workspace appear as dashed "unresolved" nodes
- **Helm support** — Strips Go template syntax (`{{ }}`) to parse Helm chart templates
- **Multi-document YAML** — Handles `---`-separated documents in a single file

### 🚀 Argo Ecosystem

| Argo Project | What's Parsed |
|--------------|---------------|
| **Argo CD** | `Application`, `ApplicationSet`, `AppProject` — destination namespaces, Helm chart sources, project memberships |
| **Argo Workflows** | `Workflow`, `WorkflowTemplate`, `CronWorkflow` — template references, container images, cross-workflow dependencies |
| **Argo Rollouts** | `Rollout`, `AnalysisTemplate` — canary/stable services, analysis template triggers |
| **Argo Events** | `EventSource`, `Sensor`, `EventBus` — event source dependencies, trigger targets |

### 📊 Architectural Insights
- **Circular dependency detection** — DFS-based cycle finding
- **High coupling warnings** — Afferent + efferent coupling analysis
- **Orphaned file identification** — Files with no project connections
- **Dependency hotspot detection** — Most-imported files that have wide impact

### ⚡ Performance
- **Incremental analysis** — File-watching cache that re-parses only changed files
- **Progress reporting** — Real-time progress for large codebases
- **Configurable limits** — Set max files and custom glob patterns

---

## <a id="screenshots"></a>🖼️ Screenshots

<div align="center">

### Architecture Map
<img src="./media/architecture-map.png" alt="Architecture Map overview" width="100%" />

*Full architecture overview — imports, calls, components, routes, and infrastructure in one graph*

---

### Dependency Graph
<img src="./media/dependency-graph.png" alt="Dependency Graph view" width="100%" />

*File-level import/export relationships with directory grouping*

---

### Call Graph
<img src="./media/call-graph.png" alt="Call Graph view" width="100%" />

*Function and method call relationships across the codebase*

---

### Kubernetes Map
<img src="./media/kubernetes-map.png" alt="Kubernetes Map view" width="100%" />

*Deployments, Services, Ingresses, ConfigMaps, and their relationships*

---

### Argo Map
<img src="./media/argo-map.png" alt="Argo Map view" width="100%" />

*Argo CD Applications, Workflows, Rollouts, Events, and their connections*

---

### Focus Mode
<img src="./media/focus-mode.png" alt="Focus mode — isolate a node and its connections" width="100%" />

*Double-click a node to isolate it and its direct connections*

---

### Context Menu & Search
<img src="./media/context-menu.png" alt="Context menu and search" width="100%" />

*Right-click for dependencies, dependents, path tracing — fuzzy search with Ctrl/Cmd+F*

---

### Architectural Insights
<img src="./media/insights-panel.png" alt="Architectural Insights panel" width="100%" />

*Circular dependencies, coupling warnings, orphans, and hotspots*

---

### Sidebar
<img src="./media/sidebar.png" alt="Code Atlas sidebar" width="100%" />

*Quick actions, active file operations, and usage tips*

</div>

---

## <a id="quick-start"></a>🚀 Quick Start

Get started with Code Atlas in minutes! Choose your preferred setup method below.

### 📦 Option 1: Install from VSIX (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/code-atlas/code-atlas.git
cd code-atlas

# 2. Install dependencies
npm install

# 3. Package the extension
npm run package

# That's it! 🎉
# Install the generated .vsix via "Extensions: Install from VSIX..." in VS Code / Cursor
```

### 💻 Option 2: Development Mode

Perfect for contributors and developers who want to hack on the extension:

#### Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **npm 9+** — Included with Node.js
- **VS Code 1.85+** or **Cursor** — [Download VS Code](https://code.visualstudio.com/)

#### Setup Steps

```bash
# 1. Clone and install
git clone https://github.com/code-atlas/code-atlas.git
cd code-atlas
npm install

# 2. Build the extension
npm run build

# 3. Launch
# Press F5 in VS Code / Cursor to open the Extension Development Host
```

### 🎬 First Steps

1. Open a project in the Extension Development Host
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **Code Atlas: Show Architecture Map**
4. Explore the interactive graph!

### For Kubernetes / Argo Projects

1. Open a repository containing YAML manifests (K8s, Helm charts, Argo configs)
2. Run **Code Atlas: Show Kubernetes Map** to see all K8s resources and their relationships
3. Run **Code Atlas: Show Argo Map** to focus on Argo CD, Workflows, Rollouts, and Events
4. Right-click any YAML file in the explorer and select **Atlas > Show File in Graph**

> **💡 Tip:** Use `npm run watch` for live-reloading during development!

---

## <a id="commands"></a>🎹 Commands

| Command | Description |
|---------|-------------|
| `Code Atlas: Show Architecture Map` | Full architecture overview (all relationships) |
| `Code Atlas: Show Dependency Graph` | File-level import/export dependencies |
| `Code Atlas: Show Call Graph` | Function and method call relationships |
| `Code Atlas: Show Component Tree` | React component render hierarchy |
| `Code Atlas: Show Route Map` | Application routes (Express, Next.js, React Router) |
| `Code Atlas: Show User Flow` | Entry-point-to-dependency traversal |
| `Code Atlas: Show Kubernetes Map` | Kubernetes resource relationships |
| `Code Atlas: Show Argo Map` | Argo CD / Workflows / Rollouts / Events |
| `Code Atlas: Refresh` | Re-analyze the entire workspace |
| `Code Atlas: Export Graph` | Export current graph view |
| `Code Atlas: Show File in Graph` | Locate the active file in the current graph |
| `Code Atlas: Show File Dependencies` | Dependency graph for a single file |
| `Code Atlas: Show Called Functions` | Call graph for a single file |
| `Code Atlas: Show Reverse Dependencies` | Files that import the active file |

### Context Menu (Right-click)

Right-click any `.ts`, `.tsx`, `.js`, `.jsx`, `.yaml`, or `.yml` file in the Explorer or Editor to access the **Atlas** submenu with file-specific views.

### ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Arrow keys` | Pan the graph |
| `Shift + Arrow keys` | Fast pan |
| `+` / `-` | Zoom in / out |
| `0` | Fit to view |
| `Ctrl/Cmd + F` | Search nodes |
| `Escape` | Clear highlight / close search |
| `F` | Toggle focus mode on selected node |

---

## <a id="configuration"></a>⚙️ Configuration

All settings are under the `codeAtlas` namespace in VS Code settings.

| Setting | Default | Description |
|---------|---------|-------------|
| `codeAtlas.include` | `["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.yaml", "**/*.yml"]` | Glob patterns for files to include in analysis |
| `codeAtlas.exclude` | `["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"]` | Glob patterns for files to exclude |
| `codeAtlas.maxFiles` | `1000` | Maximum number of files to analyze |
| `codeAtlas.defaultLayout` | `"dagre"` | Default layout algorithm (`dagre`, `dagreLR`, `grid`, `circle`) |

### Example: Kubernetes-only Analysis

```json
{
  "codeAtlas.include": ["**/*.yaml", "**/*.yml"],
  "codeAtlas.exclude": ["**/node_modules/**", "**/.git/**"]
}
```

### Example: Large Monorepo

```json
{
  "codeAtlas.include": ["apps/**/*.ts", "packages/**/*.ts", "k8s/**/*.yaml"],
  "codeAtlas.maxFiles": 5000
}
```

---

## <a id="architecture"></a>🏗️ Architecture

```
src/                         Extension host (Node.js)
├── extension.ts             Entry point, command registration
├── types.ts                 Shared type definitions
├── parsers/
│   ├── scanner.ts           File discovery via VS Code API
│   ├── astParser.ts         TypeScript AST — imports, symbols, calls
│   ├── routeParser.ts       Route detection (Express, React Router, Next.js)
│   └── yamlParser.ts        YAML/K8s/Argo/Helm resource extraction
├── graph/
│   └── graphBuilder.ts      Graph construction for all view types
├── insights/
│   └── analyzer.ts          Circular deps, coupling, orphans, hotspots
├── cache/
│   └── cacheManager.ts      Incremental file-watching cache
├── sidebar/
│   └── sidebarProvider.ts   Activity bar tree view
└── webview/
    ├── panelManager.ts      Webview panel lifecycle & messaging
    └── contentProvider.ts   HTML/CSP template

webview-ui/                  Browser-side (Cytoscape.js)
├── main.ts                  Message handler, initialization
├── graph/
│   ├── renderer.ts          Cytoscape.js rendering & layouts
│   └── interactions.ts      Click, hover, context menu, keyboard
├── ui/
│   ├── controls.ts          Toolbar (view, layout, zoom)
│   ├── search.ts            Node search (Ctrl+F)
│   ├── filters.ts           Node type filtering
│   ├── minimap.ts           Minimap overlay
│   ├── fileDepsPanel.ts     File dependencies sidebar
│   └── insightsPanel.ts     Architectural insights sidebar
├── export/
│   └── exporter.ts          PNG/SVG/JSON/Draw.io export
└── styles/
    └── main.css             VS Code theme-aware styles
```

### Data Flow

```
User Command / Sidebar Click
        ↓
extension.ts
        ↓
Scanner.scan() → file paths
        ↓
    ┌───────────────────────┐
    │  .ts/.js files        │  .yaml/.yml files
    │  AstParser.parseFile  │  YamlParser.extractResources
    │  RouteParser          │  YamlParser.parseFile
    │  CacheManager         │
    └───────────┬───────────┘
                ↓
GraphBuilder.build() → { nodes, edges }
Analyzer.analyze() → insights
                ↓
PanelManager.sendGraph() + sendInsights()
                ↓
Webview (main.ts) receives messages
                ↓
GraphRenderer.setData() → Cytoscape.js
                ↓
Interactive graph with tooltips, context menus, filters
```

### Tech Stack

<table>
<tr>
<td><strong>Language</strong></td>
<td>TypeScript (entire codebase)</td>
</tr>
<tr>
<td><strong>Extension API</strong></td>
<td>VS Code Extension API</td>
</tr>
<tr>
<td><strong>Code Parsing</strong></td>
<td>TypeScript Compiler API (AST)</td>
</tr>
<tr>
<td><strong>YAML Parsing</strong></td>
<td>js-yaml</td>
</tr>
<tr>
<td><strong>Graph Visualization</strong></td>
<td>Cytoscape.js • cytoscape-dagre</td>
</tr>
<tr>
<td><strong>Bundler</strong></td>
<td>esbuild</td>
</tr>
<tr>
<td><strong>Testing</strong></td>
<td>Mocha</td>
</tr>
</table>

### Supported Languages & Formats

<table>
<tr>
<td><strong>Source Code</strong></td>
<td>TypeScript (.ts, .tsx) • JavaScript (.js, .jsx, .mjs, .cjs)</td>
</tr>
<tr>
<td><strong>Infrastructure</strong></td>
<td>Kubernetes manifests • Helm charts • Argo CD • Argo Workflows • Argo Rollouts • Argo Events</td>
</tr>
<tr>
<td><strong>Formats</strong></td>
<td>YAML (.yaml, .yml) — multi-document, Go template syntax</td>
</tr>
</table>

### Relationship Types Detected

| Relationship | Example |
|-------------|---------|
| `deploys` | Workload container images |
| `exposes` | Ingress exposing a Service |
| `configures` | ConfigMap/Secret referenced by a Deployment |
| `mounts` | Volume mounts (ConfigMap, Secret, PVC) |
| `selects` | Service selector targeting a Deployment |
| `targets` | HPA targeting a Deployment, Rollout targeting Services |
| `contains` | Argo Application belonging to an AppProject |
| `syncs` | Argo Application syncing a Helm chart |
| `triggers` | Sensor triggering a Workflow, Rollout triggering AnalysisTemplate |
| `depends` | Sensor depending on an EventSource |
| `references` | RoleBinding referencing a Role/ServiceAccount, Workflow referencing WorkflowTemplate |

---

## <a id="development"></a>🛠️ Development

### Scripts

```bash
npm run build      # Build extension and webview
npm run watch      # Watch mode for development
npm run lint       # Type-check with tsc (no emit)
npm run test       # Run unit tests
npm run package    # Create .vsix package
```

### Running Locally

1. Clone the repo and run `npm install`
2. Run `npm run build` (or `npm run watch` for live reload)
3. Press `F5` to open the Extension Development Host
4. The extension activates when you run any `Code Atlas:` command

### Adding a New K8s Resource Type

The YAML parser (`src/parsers/yamlParser.ts`) uses a pattern-based approach to extract relationships. To add support for a new resource kind:

1. Add the kind to the relevant `Set` (`K8S_CORE_KINDS` or `ARGO_KINDS`)
2. Create an `extractXxxRefs` method in the `YamlParser` class
3. Add a `case` in `extractReferences()` to call your new method
4. Add a category mapping in `getResourceCategory()`
5. Run `npm run build` and test with sample manifests

### Adding a New View Type

1. Add the view name to `ViewType` in `src/types.ts`
2. Add a `case` in `GraphBuilder.build()` with a new builder method
3. Add the `<option>` to the view selector in `src/webview/contentProvider.ts`
4. Register a new command in `extension.ts` and `package.json`

---

## <a id="contributing"></a>🤝 Contributing

We **love** contributions from the community! Whether you're a seasoned architect or just curious about code visualization, your contributions are valuable and welcome! 🙌

Code Atlas is built by developers, for developers. We believe in:
- ✨ **Welcoming everyone** — All skill levels are encouraged to contribute
- 🤝 **Helping each other** — No question is too small
- 🎯 **Clear communication** — We value constructive feedback
- 🚀 **Moving fast** — But not breaking things

### 🌟 Ways to Contribute

<table>
<tr>
<td width="33%" align="center">
  <h3>🐛 Fix Bugs</h3>
  <p>Found something broken? Help us fix it!</p>
</td>
<td width="33%" align="center">
  <h3>✨ Add Features</h3>
  <p>New parsers, views, or export formats — let's build it!</p>
</td>
<td width="33%" align="center">
  <h3>📚 Improve Docs</h3>
  <p>Make our docs clearer and more helpful</p>
</td>
</tr>
<tr>
<td width="33%" align="center">
  <h3>🎨 Enhance UI/UX</h3>
  <p>Make the graph experience even better</p>
</td>
<td width="33%" align="center">
  <h3>🧪 Write Tests</h3>
  <p>Help us maintain quality</p>
</td>
<td width="33%" align="center">
  <h3>💬 Answer Questions</h3>
  <p>Help others in Discussions</p>
</td>
</tr>
</table>

### 🚀 Quick Contribution Guide

```bash
# 1. Fork and clone
git clone https://github.com/yourusername/code-atlas.git
cd code-atlas

# 2. Create a branch
git checkout -b feature/amazing-feature

# 3. Install and build
npm install
npm run build

# 4. Make your changes and test (F5 in VS Code)

# 5. Commit your changes
git commit -m 'add amazing feature'

# 6. Push and open a PR
git push origin feature/amazing-feature
```

### 🆕 First Time Contributors?

Look for issues labeled:
- **`good first issue`** — Perfect for newcomers
- **`help wanted`** — We need community help
- **`documentation`** — Great for learning the codebase

Don't see an issue that fits? **Create a new one** — we're happy to help you get started!

### 💡 Areas for Contribution

- Additional K8s resource types (Istio, Knative, Tekton, Crossplane, etc.)
- Docker Compose file parsing
- Terraform / Pulumi infrastructure visualization
- Python / Go / Java code analysis
- Graph performance optimizations for very large codebases
- Additional export formats
- Automated tests for the YAML parser

---

## <a id="license"></a>📄 License

Code Atlas is open source software licensed under the **[MIT License](LICENSE)**.

```
Copyright (c) 2025
```

**Free to use & modify.**

---

## <a id="acknowledgments"></a>🙏 Acknowledgments

Built with these amazing open source projects:

[Cytoscape.js](https://js.cytoscape.org/) • [cytoscape-dagre](https://github.com/cytoscape/cytoscape.js-dagre) • [js-yaml](https://github.com/nodeca/js-yaml) • [esbuild](https://esbuild.github.io/) • [TypeScript](https://www.typescriptlang.org/) • [Mocha](https://mochajs.org/) • [VS Code Extension API](https://code.visualstudio.com/api)

**Special thanks to all contributors who help make Code Atlas better!** ⭐

---
