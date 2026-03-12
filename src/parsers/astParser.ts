import * as ts from 'typescript';
import * as path from 'path';
import { ParsedFile, ParsedImport, ParsedSymbol, NodeType } from '../types';

export class AstParser {
  parseFile(filePath: string, content: string): ParsedFile {
    const scriptKind = this.getScriptKind(filePath);
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    const imports: ParsedImport[] = [];
    const symbols: ParsedSymbol[] = [];
    const exports: string[] = [];

    this.visitNode(sourceFile, sourceFile, imports, symbols, exports, filePath);

    return { filePath, imports, symbols, exports };
  }

  private visitNode(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    imports: ParsedImport[],
    symbols: ParsedSymbol[],
    exports: string[],
    filePath: string,
  ): void {
    if (ts.isImportDeclaration(node)) {
      this.extractImport(node, sourceFile, imports);
    }

    if (ts.isExportDeclaration(node)) {
      this.extractExportDeclaration(node, exports);
    }

    if (ts.isExportAssignment(node)) {
      exports.push('default');
    }

    if (ts.isClassDeclaration(node) && node.name) {
      this.extractClassSymbol(node, sourceFile, symbols, exports, filePath);
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      this.extractFunctionSymbol(node, sourceFile, symbols, exports, filePath);
    }

    if (ts.isVariableStatement(node)) {
      this.extractVariableSymbols(node, sourceFile, symbols, exports, imports, filePath);
    }

    if (ts.isInterfaceDeclaration(node)) {
      const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const isExported = this.hasExportModifier(node);
      symbols.push({
        name: node.name.text,
        type: 'interface',
        line: pos.line + 1,
        column: pos.character + 1,
        exported: isExported,
      });
      if (isExported) { exports.push(node.name.text); }
    }

    if (ts.isEnumDeclaration(node)) {
      const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const isExported = this.hasExportModifier(node);
      symbols.push({
        name: node.name.text,
        type: 'enum',
        line: pos.line + 1,
        column: pos.character + 1,
        exported: isExported,
      });
      if (isExported) { exports.push(node.name.text); }
    }

    ts.forEachChild(node, child =>
      this.visitNode(child, sourceFile, imports, symbols, exports, filePath),
    );
  }

  private extractImport(
    node: ts.ImportDeclaration,
    sourceFile: ts.SourceFile,
    imports: ParsedImport[],
  ): void {
    if (!ts.isStringLiteral(node.moduleSpecifier)) { return; }

    const source = node.moduleSpecifier.text;
    const specifiers: string[] = [];
    let isDefault = false;

    if (node.importClause) {
      if (node.importClause.name) {
        isDefault = true;
        specifiers.push(node.importClause.name.text);
      }
      if (node.importClause.namedBindings) {
        if (ts.isNamedImports(node.importClause.namedBindings)) {
          for (const spec of node.importClause.namedBindings.elements) {
            specifiers.push(spec.name.text);
          }
        } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          specifiers.push(`* as ${node.importClause.namedBindings.name.text}`);
        }
      }
    }

    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    imports.push({
      source,
      specifiers,
      isDefault,
      isDynamic: false,
      line: pos.line + 1,
    });
  }

  private extractVariableSymbols(
    node: ts.VariableStatement,
    sourceFile: ts.SourceFile,
    symbols: ParsedSymbol[],
    exports: string[],
    imports: ParsedImport[],
    filePath: string,
  ): void {
    const isExported = this.hasExportModifier(node);

    for (const decl of node.declarationList.declarations) {
      // Handle require() calls
      if (decl.initializer && ts.isCallExpression(decl.initializer)) {
        const call = decl.initializer;
        if (
          ts.isIdentifier(call.expression) &&
          call.expression.text === 'require' &&
          call.arguments.length === 1 &&
          ts.isStringLiteral(call.arguments[0])
        ) {
          const name = decl.name && ts.isIdentifier(decl.name) ? decl.name.text : 'unknown';
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          imports.push({
            source: call.arguments[0].text,
            specifiers: [name],
            isDefault: true,
            isDynamic: false,
            line: pos.line + 1,
          });
        }
      }

      if (!ts.isIdentifier(decl.name)) { continue; }
      const name = decl.name.text;
      const pos = sourceFile.getLineAndCharacterOfPosition(decl.getStart(sourceFile));

      if (decl.initializer) {
        if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
          const jsxElements = this.findJsxElements(decl.initializer);
          const calls = this.findFunctionCalls(decl.initializer);
          const isComponent = jsxElements.length > 0 ||
            (this.isJsxFile(filePath) && /^[A-Z]/.test(name));

          symbols.push({
            name,
            type: isComponent ? 'component' : 'function',
            line: pos.line + 1,
            column: pos.character + 1,
            exported: isExported,
            jsxElements: jsxElements.length > 0 ? jsxElements : undefined,
            calls: calls.length > 0 ? calls : undefined,
          });
        } else {
          symbols.push({
            name,
            type: 'variable',
            line: pos.line + 1,
            column: pos.character + 1,
            exported: isExported,
          });
        }
      } else {
        symbols.push({
          name,
          type: 'variable',
          line: pos.line + 1,
          column: pos.character + 1,
          exported: isExported,
        });
      }

      if (isExported) { exports.push(name); }
    }
  }

  private extractClassSymbol(
    node: ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
    symbols: ParsedSymbol[],
    exports: string[],
    filePath: string,
  ): void {
    const name = node.name!.text;
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const isExported = this.hasExportModifier(node);

    let extendsClause: string | undefined;
    const implementsArr: string[] = [];

    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword && clause.types.length > 0) {
          extendsClause = clause.types[0].expression.getText(sourceFile);
        }
        if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
          for (const type of clause.types) {
            implementsArr.push(type.expression.getText(sourceFile));
          }
        }
      }
    }

    const jsxElements = this.findJsxElements(node);
    const calls = this.findFunctionCalls(node);
    const isComponent =
      jsxElements.length > 0 ||
      (extendsClause !== undefined &&
        (extendsClause.includes('Component') || extendsClause.includes('PureComponent'))) ||
      (this.isJsxFile(filePath) && /^[A-Z]/.test(name) && jsxElements.length > 0);

    symbols.push({
      name,
      type: isComponent ? 'component' : 'class',
      line: pos.line + 1,
      column: pos.character + 1,
      exported: isExported,
      extends: extendsClause,
      implements: implementsArr.length > 0 ? implementsArr : undefined,
      jsxElements: jsxElements.length > 0 ? jsxElements : undefined,
      calls: calls.length > 0 ? calls : undefined,
    });

    if (isExported) { exports.push(name); }
  }

  private extractFunctionSymbol(
    node: ts.FunctionDeclaration,
    sourceFile: ts.SourceFile,
    symbols: ParsedSymbol[],
    exports: string[],
    filePath: string,
  ): void {
    const name = node.name!.text;
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const isExported = this.hasExportModifier(node);

    const jsxElements = this.findJsxElements(node);
    const calls = this.findFunctionCalls(node);
    const isComponent = jsxElements.length > 0 ||
      (this.isJsxFile(filePath) && /^[A-Z]/.test(name));

    symbols.push({
      name,
      type: isComponent ? 'component' : 'function',
      line: pos.line + 1,
      column: pos.character + 1,
      exported: isExported,
      jsxElements: jsxElements.length > 0 ? jsxElements : undefined,
      calls: calls.length > 0 ? calls : undefined,
    });

    if (isExported) { exports.push(name); }
  }

  private extractExportDeclaration(node: ts.ExportDeclaration, exports: string[]): void {
    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const spec of node.exportClause.elements) {
        exports.push(spec.name.text);
      }
    }
  }

  private findJsxElements(node: ts.Node): string[] {
    const elements: string[] = [];
    const visit = (child: ts.Node): void => {
      if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) {
        const tagName = child.tagName.getText();
        if (/^[A-Z]/.test(tagName) && tagName !== 'React.Fragment') {
          if (!elements.includes(tagName)) {
            elements.push(tagName);
          }
        }
      }
      ts.forEachChild(child, visit);
    };
    ts.forEachChild(node, visit);
    return elements;
  }

  private findFunctionCalls(node: ts.Node): string[] {
    const calls: string[] = [];
    const visit = (child: ts.Node): void => {
      if (ts.isCallExpression(child)) {
        let name = '';
        if (ts.isIdentifier(child.expression)) {
          name = child.expression.text;
        } else if (ts.isPropertyAccessExpression(child.expression)) {
          name = child.expression.getText();
        }
        if (name && !calls.includes(name) && !this.isBuiltinCall(name)) {
          calls.push(name);
        }
      }
      ts.forEachChild(child, visit);
    };
    ts.forEachChild(node, visit);
    return calls;
  }

  private isBuiltinCall(name: string): boolean {
    const builtins = new Set([
      'require', 'console.log', 'console.error', 'console.warn',
      'parseInt', 'parseFloat', 'JSON.parse', 'JSON.stringify',
      'Object.keys', 'Object.values', 'Object.entries', 'Object.assign',
      'Array.isArray', 'Promise.resolve', 'Promise.reject', 'Promise.all',
      'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    ]);
    return builtins.has(name);
  }

  private hasExportModifier(node: ts.Node): boolean {
    if (!ts.canHaveModifiers(node)) { return false; }
    const modifiers = ts.getModifiers(node);
    return modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
  }

  private isJsxFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.tsx' || ext === '.jsx';
  }

  private getScriptKind(filePath: string): ts.ScriptKind {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.tsx': return ts.ScriptKind.TSX;
      case '.jsx': return ts.ScriptKind.JSX;
      case '.js':
      case '.mjs':
      case '.cjs': return ts.ScriptKind.JS;
      default: return ts.ScriptKind.TS;
    }
  }
}
