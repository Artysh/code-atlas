import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { AstParser } from '../../src/parsers/astParser';

const FIXTURES_ROOT = path.join(process.cwd(), 'test', 'fixtures');

describe('AstParser', () => {
  const parser = new AstParser();

  describe('import extraction', () => {
    it('should extract ES imports', () => {
      const filePath = path.join(FIXTURES_ROOT, 'simple-project', 'index.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = parser.parseFile(filePath, content);

      assert.ok(result.imports.length >= 2, `expected >= 2 imports, got ${result.imports.length}`);

      const utilsImport = result.imports.find(i => i.source === './utils');
      assert.ok(utilsImport, 'should find ./utils import');
      assert.ok(utilsImport.specifiers.includes('formatDate'), 'should import formatDate');
      assert.ok(utilsImport.specifiers.includes('capitalize'), 'should import capitalize');

      const serviceImport = result.imports.find(i => i.source === './service');
      assert.ok(serviceImport, 'should find ./service import');
      assert.ok(serviceImport.specifiers.includes('UserService'), 'should import UserService');
    });

    it('should detect default imports', () => {
      const filePath = path.join(FIXTURES_ROOT, 'react-project', 'App.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = parser.parseFile(filePath, content);

      const reactImport = result.imports.find(i => i.source === 'react');
      assert.ok(reactImport, 'should find react import');
      assert.ok(reactImport.isDefault, 'react import should be default');
    });
  });

  describe('symbol extraction', () => {
    it('should extract class declarations', () => {
      const filePath = path.join(FIXTURES_ROOT, 'simple-project', 'service.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = parser.parseFile(filePath, content);

      const userService = result.symbols.find(s => s.name === 'UserService');
      assert.ok(userService, 'should find UserService class');
      assert.equal(userService.type, 'class');
      assert.ok(userService.exported, 'UserService should be exported');
    });

    it('should extract function declarations', () => {
      const filePath = path.join(FIXTURES_ROOT, 'simple-project', 'utils.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = parser.parseFile(filePath, content);

      const formatDate = result.symbols.find(s => s.name === 'formatDate');
      assert.ok(formatDate, 'should find formatDate function');
      assert.equal(formatDate.type, 'function');
      assert.ok(formatDate.exported, 'formatDate should be exported');

      const capitalize = result.symbols.find(s => s.name === 'capitalize');
      assert.ok(capitalize, 'should find capitalize function');
    });

    it('should extract enum declarations', () => {
      const filePath = path.join(FIXTURES_ROOT, 'simple-project', 'service.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = parser.parseFile(filePath, content);

      const role = result.symbols.find(s => s.name === 'UserRole');
      assert.ok(role, 'should find UserRole enum');
      assert.equal(role.type, 'enum');
    });

    it('should extract interface declarations', () => {
      const filePath = path.join(FIXTURES_ROOT, 'react-project', 'components', 'Header.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = parser.parseFile(filePath, content);

      const props = result.symbols.find(s => s.name === 'HeaderProps');
      assert.ok(props, 'should find HeaderProps interface');
      assert.equal(props.type, 'interface');
    });

    it('should extract exported variables', () => {
      const filePath = path.join(FIXTURES_ROOT, 'simple-project', 'utils.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = parser.parseFile(filePath, content);

      const version = result.symbols.find(s => s.name === 'VERSION');
      assert.ok(version, 'should find VERSION variable');
      assert.ok(version.exported, 'VERSION should be exported');
    });
  });

  describe('React component detection', () => {
    it('should detect arrow function components in .tsx files', () => {
      const filePath = path.join(FIXTURES_ROOT, 'react-project', 'App.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = parser.parseFile(filePath, content);

      const app = result.symbols.find(s => s.name === 'App');
      assert.ok(app, 'should find App component');
      assert.equal(app.type, 'component', 'App should be detected as a component');
    });

    it('should detect JSX elements rendered by components', () => {
      const filePath = path.join(FIXTURES_ROOT, 'react-project', 'App.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = parser.parseFile(filePath, content);

      const app = result.symbols.find(s => s.name === 'App');
      assert.ok(app, 'should find App');
      assert.ok(app.jsxElements, 'App should have jsxElements');
      assert.ok(app.jsxElements!.includes('Header'), 'App should render Header');
      assert.ok(app.jsxElements!.includes('Footer'), 'App should render Footer');
      assert.ok(app.jsxElements!.includes('Routes'), 'App should render Routes');
    });
  });

  describe('export tracking', () => {
    it('should track all exports from a file', () => {
      const filePath = path.join(FIXTURES_ROOT, 'simple-project', 'utils.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = parser.parseFile(filePath, content);

      assert.ok(result.exports.includes('formatDate'), 'should export formatDate');
      assert.ok(result.exports.includes('capitalize'), 'should export capitalize');
      assert.ok(result.exports.includes('slugify'), 'should export slugify');
      assert.ok(result.exports.includes('VERSION'), 'should export VERSION');
    });
  });
});
