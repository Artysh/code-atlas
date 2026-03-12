export type NodeType = 'file' | 'class' | 'function' | 'component' | 'route' | 'module' | 'interface' | 'enum' | 'variable';

export type EdgeType = 'import' | 'call' | 'render' | 'route' | 'extends' | 'implements';

export type ViewType = 'architecture' | 'dependency' | 'callGraph' | 'componentTree' | 'routeMap';

export type LayoutType = 'dagre' | 'cose' | 'breadthfirst' | 'grid' | 'circle';

export type InsightSeverity = 'error' | 'warning' | 'info';

export type InsightType =
  | 'circularDependency'
  | 'highCoupling'
  | 'orphanedFile'
  | 'hotspot'
  | 'architecturalViolation';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  filePath: string;
  line?: number;
  column?: number;
  parent?: string;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface ParsedImport {
  source: string;
  specifiers: string[];
  isDefault: boolean;
  isDynamic: boolean;
  line: number;
}

export interface ParsedSymbol {
  name: string;
  type: NodeType;
  line: number;
  column: number;
  exported: boolean;
  jsxElements?: string[];
  calls?: string[];
  extends?: string;
  implements?: string[];
}

export interface ParsedFile {
  filePath: string;
  imports: ParsedImport[];
  symbols: ParsedSymbol[];
  exports: string[];
}

export interface ParsedRoute {
  path: string;
  method?: string;
  handler?: string;
  component?: string;
  filePath: string;
  line: number;
}

export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  affectedNodes: string[];
  affectedEdges?: string[];
}

export interface AnalysisResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  insights: Insight[];
}

// Cytoscape-compatible element shapes

export interface CyNodeData {
  data: {
    id: string;
    label: string;
    type: NodeType;
    filePath: string;
    line?: number;
    column?: number;
    parent?: string;
    [key: string]: unknown;
  };
}

export interface CyEdgeData {
  data: {
    id: string;
    source: string;
    target: string;
    type: EdgeType;
    label?: string;
    [key: string]: unknown;
  };
}

// Message protocols

export type ToWebviewMessage =
  | { command: 'setGraph'; data: { nodes: CyNodeData[]; edges: CyEdgeData[] } }
  | { command: 'setInsights'; data: Insight[] }
  | { command: 'setView'; view: ViewType }
  | { command: 'highlight'; nodeIds: string[] }
  | { command: 'setLoading'; loading: boolean };

export type ToExtensionMessage =
  | { command: 'openFile'; filePath: string; line?: number; column?: number }
  | { command: 'requestRefresh' }
  | { command: 'saveExport'; format: 'png' | 'svg' | 'json'; data: string }
  | { command: 'changeView'; view: ViewType }
  | { command: 'changeLayout'; layout: LayoutType }
  | { command: 'ready' };
