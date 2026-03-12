import { strict as assert } from 'assert';
import * as path from 'path';
import { Analyzer } from '../../src/insights/analyzer';
import { ParsedFile } from '../../src/types';

describe('Analyzer', () => {
  const analyzer = new Analyzer();
  const root = '/project';

  function makeParsedFile(filePath: string, importSources: string[]): ParsedFile {
    return {
      filePath,
      imports: importSources.map(source => ({
        source,
        specifiers: ['default'],
        isDefault: true,
        isDynamic: false,
        line: 1,
      })),
      symbols: [{ name: 'default', type: 'function' as const, line: 1, column: 1, exported: true }],
      exports: ['default'],
    };
  }

  describe('circular dependency detection', () => {
    it('should detect a simple circular dependency', () => {
      const files: ParsedFile[] = [
        makeParsedFile('/project/a.ts', ['./b']),
        makeParsedFile('/project/b.ts', ['./a']),
      ];

      const insights = analyzer.analyze(files, root);
      const circular = insights.filter(i => i.type === 'circularDependency');
      assert.ok(circular.length > 0, 'should detect circular dependency between a.ts and b.ts');
    });

    it('should detect transitive circular dependencies', () => {
      const files: ParsedFile[] = [
        makeParsedFile('/project/a.ts', ['./b']),
        makeParsedFile('/project/b.ts', ['./c']),
        makeParsedFile('/project/c.ts', ['./a']),
      ];

      const insights = analyzer.analyze(files, root);
      const circular = insights.filter(i => i.type === 'circularDependency');
      assert.ok(circular.length > 0, 'should detect A -> B -> C -> A cycle');
    });

    it('should not report false positives for acyclic graphs', () => {
      const files: ParsedFile[] = [
        makeParsedFile('/project/a.ts', ['./b', './c']),
        makeParsedFile('/project/b.ts', ['./c']),
        makeParsedFile('/project/c.ts', []),
      ];

      const insights = analyzer.analyze(files, root);
      const circular = insights.filter(i => i.type === 'circularDependency');
      assert.equal(circular.length, 0, 'should not detect circular dependencies in a DAG');
    });
  });

  describe('orphaned file detection', () => {
    it('should detect files with no imports and not imported', () => {
      const files: ParsedFile[] = [
        makeParsedFile('/project/a.ts', ['./b']),
        makeParsedFile('/project/b.ts', []),
        makeParsedFile('/project/orphan.ts', []),
      ];

      const insights = analyzer.analyze(files, root);
      const orphans = insights.filter(i => i.type === 'orphanedFile');

      const orphanPaths = orphans.flatMap(o => o.affectedNodes);
      assert.ok(
        orphanPaths.includes('/project/orphan.ts'),
        'should detect orphan.ts as orphaned',
      );
      assert.ok(
        !orphanPaths.includes('/project/b.ts'),
        'b.ts should not be orphaned (it is imported by a.ts)',
      );
    });
  });

  describe('hotspot detection', () => {
    it('should detect files imported by many others', () => {
      const files: ParsedFile[] = [];
      files.push(makeParsedFile('/project/shared.ts', []));

      for (let i = 0; i < 20; i++) {
        files.push(makeParsedFile(`/project/consumer${i}.ts`, ['./shared']));
      }

      const insights = analyzer.analyze(files, root);
      const hotspots = insights.filter(i => i.type === 'hotspot');

      assert.ok(hotspots.length > 0, 'should detect shared.ts as a hotspot');
      const affectedPaths = hotspots.flatMap(h => h.affectedNodes);
      assert.ok(affectedPaths.includes('/project/shared.ts'));
    });
  });

  describe('high coupling detection', () => {
    it('should detect highly-coupled files', () => {
      const files: ParsedFile[] = [];
      const hubFile = makeParsedFile('/project/hub.ts', []);
      hubFile.imports = [];

      for (let i = 0; i < 15; i++) {
        const f = makeParsedFile(`/project/dep${i}.ts`, []);
        hubFile.imports.push({
          source: `./dep${i}`,
          specifiers: ['default'],
          isDefault: true,
          isDynamic: false,
          line: i + 1,
        });
        files.push(f);
      }
      files.push(hubFile);

      const insights = analyzer.analyze(files, root);
      const coupling = insights.filter(i => i.type === 'highCoupling');
      // With 16 files, threshold is max(5, floor(16*0.1)) = 5
      // Hub has 15 efferent deps, so total coupling is >= 15 which exceeds threshold
      assert.ok(coupling.length > 0, 'should detect hub.ts as highly coupled');
    });
  });
});
