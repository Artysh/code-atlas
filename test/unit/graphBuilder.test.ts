import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { AstParser } from '../../src/parsers/astParser';
import { GraphBuilder } from '../../src/graph/graphBuilder';
import { ParsedFile } from '../../src/types';

const FIXTURES_ROOT = path.join(process.cwd(), 'test', 'fixtures');

describe('GraphBuilder', () => {
  const parser = new AstParser();
  const builder = new GraphBuilder();

  function parseFixtures(projectDir: string): ParsedFile[] {
    const files = fs.readdirSync(projectDir, { recursive: true, withFileTypes: true });
    const parsed: ParsedFile[] = [];
    for (const entry of files) {
      if (!entry.isFile()) { continue; }
      const ext = path.extname(entry.name);
      if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) { continue; }
      const parentPath = (entry as any).parentPath || (entry as any).path || projectDir;
      const filePath = path.join(parentPath, entry.name);
      const content = fs.readFileSync(filePath, 'utf-8');
      parsed.push(parser.parseFile(filePath, content));
    }
    return parsed;
  }

  describe('dependency graph', () => {
    it('should create nodes for all files', () => {
      const projectDir = path.join(FIXTURES_ROOT, 'simple-project');
      const parsedFiles = parseFixtures(projectDir);
      const { nodes } = builder.build(parsedFiles, [], 'dependency', projectDir);

      const fileNodes = nodes.filter(n => n.data.type !== 'module');
      assert.equal(fileNodes.length, 3, 'should have 3 file nodes');

      const labels = fileNodes.map(n => n.data.label);
      assert.ok(labels.includes('index.ts'));
      assert.ok(labels.includes('utils.ts'));
      assert.ok(labels.includes('service.ts'));
    });

    it('should create import edges between files', () => {
      const projectDir = path.join(FIXTURES_ROOT, 'simple-project');
      const parsedFiles = parseFixtures(projectDir);
      const { edges } = builder.build(parsedFiles, [], 'dependency', projectDir);

      assert.ok(edges.length >= 2, `expected >= 2 edges, got ${edges.length}`);

      const indexToUtils = edges.find(e =>
        e.data.source.includes('index.ts') && e.data.target.includes('utils.ts'),
      );
      assert.ok(indexToUtils, 'should have edge from index.ts to utils.ts');
      assert.equal(indexToUtils.data.type, 'import');

      const indexToService = edges.find(e =>
        e.data.source.includes('index.ts') && e.data.target.includes('service.ts'),
      );
      assert.ok(indexToService, 'should have edge from index.ts to service.ts');
    });

    it('should resolve relative import paths', () => {
      const projectDir = path.join(FIXTURES_ROOT, 'simple-project');
      const parsedFiles = parseFixtures(projectDir);
      const { edges } = builder.build(parsedFiles, [], 'dependency', projectDir);

      const serviceToUtils = edges.find(e =>
        e.data.source.includes('service.ts') && e.data.target.includes('utils.ts'),
      );
      assert.ok(serviceToUtils, 'should resolve service.ts -> utils.ts import');
    });
  });

  describe('component tree', () => {
    it('should create nodes for React components', () => {
      const projectDir = path.join(FIXTURES_ROOT, 'react-project');
      const parsedFiles = parseFixtures(projectDir);
      const { nodes } = builder.build(parsedFiles, [], 'componentTree', projectDir);

      const componentNodes = nodes.filter(n => n.data.type === 'component');
      assert.ok(componentNodes.length >= 3, `expected >= 3 components, got ${componentNodes.length}`);

      const labels = componentNodes.map(n => n.data.label);
      assert.ok(labels.includes('App'), 'should find App component');
      assert.ok(labels.includes('Header'), 'should find Header component');
      assert.ok(labels.includes('Footer'), 'should find Footer component');
    });

    it('should create render edges between components', () => {
      const projectDir = path.join(FIXTURES_ROOT, 'react-project');
      const parsedFiles = parseFixtures(projectDir);
      const { edges } = builder.build(parsedFiles, [], 'componentTree', projectDir);

      const renderEdges = edges.filter(e => e.data.type === 'render');
      assert.ok(renderEdges.length >= 2, `expected >= 2 render edges, got ${renderEdges.length}`);
    });
  });

  describe('call graph', () => {
    it('should create nodes for functions and classes', () => {
      const projectDir = path.join(FIXTURES_ROOT, 'simple-project');
      const parsedFiles = parseFixtures(projectDir);
      const { nodes } = builder.build(parsedFiles, [], 'callGraph', projectDir);

      assert.ok(nodes.length > 0, 'should have function/class nodes');
      const types = new Set(nodes.map(n => n.data.type));
      assert.ok(
        types.has('function') || types.has('class') || types.has('component'),
        'should have function/class/component nodes',
      );
    });
  });
});
