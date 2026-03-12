# Code Atlas

Visualize your application's architecture directly inside VS Code and Cursor. Code Atlas uses TypeScript AST analysis to parse your codebase and renders interactive diagrams showing dependencies, call graphs, component trees, route maps, and more.

## Features

**Multiple Views**
- **Architecture Map** -- combined view of all relationships
- **Dependency Graph** -- file-level import/export connections
- **Call Graph** -- function and method call relationships
- **Component Tree** -- React component render hierarchy
- **Route Map** -- Express, Next.js, and React Router routes

**Interactive Graph**
- Zoom, pan, and drag nodes freely
- Click any node to open the source file at the exact line
- Double-click to focus on a node and its connections
- Right-click context menu for deeper exploration
- Search nodes with fuzzy matching (Ctrl/Cmd+F)
- Filter by node type (files, classes, functions, components, routes)
- Multiple layout algorithms: hierarchical (Dagre), force-directed (CoSE), breadthfirst, grid, circle
- Minimap for navigating large graphs
- Export to PNG, SVG, or JSON

**Architectural Insights**
- Circular dependency detection
- High coupling warnings (afferent + efferent analysis)
- Orphaned file identification
- Dependency hotspot detection

**Performance**
- Incremental analysis with file-watching cache
- Progress reporting for large codebases
- Configurable file limits and patterns

## Getting Started

### Install from Source

```bash
git clone https://github.com/code-atlas/code-atlas.git
cd code-atlas
npm install
npm run build
```

Press **F5** in VS Code to launch the Extension Development Host with the extension loaded.

### Usage

1. Open a TypeScript/JavaScript project in VS Code
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **Code Atlas: Show Architecture Map**
4. Explore the interactive graph

### Commands

| Command | Description |
|---------|-------------|
| `Code Atlas: Show Architecture Map` | Full architecture view |
| `Code Atlas: Show Dependency Graph` | File-level dependencies |
| `Code Atlas: Show Call Graph` | Function call relationships |
| `Code Atlas: Show Component Tree` | React component hierarchy |
| `Code Atlas: Show Route Map` | Application routes |
| `Code Atlas: Refresh` | Re-analyze the codebase |
| `Code Atlas: Export Graph` | Export current view |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `codeAtlas.include` | `["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]` | File glob patterns to include |
| `codeAtlas.exclude` | `["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"]` | File glob patterns to exclude |
| `codeAtlas.maxFiles` | `1000` | Maximum number of files to analyze |
| `codeAtlas.defaultLayout` | `"dagre"` | Default layout algorithm |

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Scripts

```bash
npm run build      # Build extension and webview
npm run watch      # Watch mode for development
npm run lint       # Type-check with tsc
npm run test       # Run unit tests
npm run package    # Create .vsix package
```

### Architecture

```
src/                    # Extension host (Node.js)
├── extension.ts        # Entry point, command registration
├── parsers/            # AST-based code analysis
│   ├── scanner.ts      # File discovery
│   ├── astParser.ts    # Import/symbol/call extraction
│   └── routeParser.ts  # Route detection
├── graph/              # Graph data construction
├── insights/           # Architectural analysis
├── cache/              # Incremental update support
└── webview/            # Webview panel management

webview-ui/             # Browser-side (Cytoscape.js)
├── graph/              # Graph rendering and interactions
├── ui/                 # Controls, search, filters, minimap, insights
├── export/             # PNG/SVG/JSON export
└── styles/             # VS Code theme-aware CSS
```

### Tech Stack

- **TypeScript** -- full codebase
- **VS Code Extension API** -- extension host
- **Cytoscape.js** -- graph visualization
- **cytoscape-dagre** -- hierarchical layout
- **esbuild** -- fast bundling
- **Mocha** -- unit testing

## License

MIT
