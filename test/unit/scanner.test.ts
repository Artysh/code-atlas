import { strict as assert } from 'assert';
import * as path from 'path';
import { scanDirectory } from '../../src/utils/fileScanner';

const FIXTURES_ROOT = path.join(process.cwd(), 'test', 'fixtures');

describe('scanDirectory', () => {
  it('should find all TypeScript files in simple-project', () => {
    const dir = path.join(FIXTURES_ROOT, 'simple-project');
    const files = scanDirectory(dir);
    const basenames = files.map(f => path.basename(f));

    assert.ok(basenames.includes('index.ts'), 'should find index.ts');
    assert.ok(basenames.includes('utils.ts'), 'should find utils.ts');
    assert.ok(basenames.includes('service.ts'), 'should find service.ts');
    assert.equal(files.length, 3);
  });

  it('should find .tsx files in react-project', () => {
    const dir = path.join(FIXTURES_ROOT, 'react-project');
    const files = scanDirectory(dir);
    const basenames = files.map(f => path.basename(f));

    assert.ok(basenames.includes('App.tsx'), 'should find App.tsx');
    assert.ok(basenames.includes('Header.tsx'), 'should find Header.tsx');
    assert.ok(basenames.includes('Footer.tsx'), 'should find Footer.tsx');
    assert.ok(basenames.includes('routes.ts'), 'should find routes.ts');
    assert.equal(files.length, 4);
  });

  it('should respect custom extensions filter', () => {
    const dir = path.join(FIXTURES_ROOT, 'simple-project');
    const files = scanDirectory(dir, ['.ts']);
    assert.equal(files.length, 3);

    const noFiles = scanDirectory(dir, ['.py']);
    assert.equal(noFiles.length, 0);
  });

  it('should return sorted paths', () => {
    const dir = path.join(FIXTURES_ROOT, 'simple-project');
    const files = scanDirectory(dir);
    const sorted = [...files].sort();
    assert.deepEqual(files, sorted);
  });
});
