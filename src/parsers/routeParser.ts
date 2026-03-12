import * as ts from 'typescript';
import * as path from 'path';
import { ParsedRoute } from '../types';

export class RouteParser {
  parseFile(filePath: string, content: string): ParsedRoute[] {
    const routes: ParsedRoute[] = [];
    const ext = path.extname(filePath).toLowerCase();
    const scriptKind = ext === '.tsx' ? ts.ScriptKind.TSX
      : ext === '.jsx' ? ts.ScriptKind.JSX
      : ext === '.js' ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;

    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);

    this.visitNode(sourceFile, sourceFile, filePath, routes);
    this.detectFileBasedRoutes(filePath, routes);

    return routes;
  }

  private visitNode(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    filePath: string,
    routes: ParsedRoute[],
  ): void {
    // Express-style: app.get('/path', handler) or router.post('/path', handler)
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text.toLowerCase();
      const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all', 'use'];

      if (httpMethods.includes(method) && node.arguments.length >= 1) {
        const firstArg = node.arguments[0];
        if (ts.isStringLiteral(firstArg)) {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          let handler: string | undefined;
          if (node.arguments.length >= 2) {
            const handlerArg = node.arguments[node.arguments.length - 1];
            if (ts.isIdentifier(handlerArg)) {
              handler = handlerArg.text;
            }
          }
          routes.push({
            path: firstArg.text,
            method: method === 'use' ? 'middleware' : method.toUpperCase(),
            handler,
            filePath,
            line: pos.line + 1,
          });
        }
      }
    }

    // React Router: <Route path="/foo" component={Bar} /> or <Route path="/foo" element={<Bar />} />
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagName = node.tagName.getText();
      if (tagName === 'Route') {
        const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        let routePath: string | undefined;
        let component: string | undefined;

        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr) || !attr.name || !ts.isIdentifier(attr.name)) { continue; }
          const attrName = attr.name.text;
          if (attrName === 'path' && attr.initializer && ts.isStringLiteral(attr.initializer)) {
            routePath = attr.initializer.text;
          }
          if ((attrName === 'component' || attrName === 'element') && attr.initializer) {
            if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
              if (ts.isIdentifier(attr.initializer.expression)) {
                component = attr.initializer.expression.text;
              } else if (ts.isJsxSelfClosingElement(attr.initializer.expression)) {
                component = attr.initializer.expression.tagName.getText();
              }
            }
          }
        }

        if (routePath) {
          routes.push({
            path: routePath,
            component,
            filePath,
            line: pos.line + 1,
          });
        }
      }
    }

    ts.forEachChild(node, child => this.visitNode(child, sourceFile, filePath, routes));
  }

  /** Detect Next.js-style file-based routes from the file path. */
  private detectFileBasedRoutes(filePath: string, routes: ParsedRoute[]): void {
    const normalized = filePath.replace(/\\/g, '/');

    const pagesMatch = normalized.match(/\/pages\/(.+)\.(tsx?|jsx?)$/);
    const appMatch = normalized.match(/\/app\/(.+)\/page\.(tsx?|jsx?)$/);

    const match = pagesMatch || appMatch;
    if (!match) { return; }

    let routePath = '/' + match[1];
    routePath = routePath.replace(/\/index$/, '/');
    routePath = routePath.replace(/\[([^\]]+)\]/g, ':$1');

    if (routePath === '/_app' || routePath === '/_document' || routePath === '/layout') {
      return;
    }

    routes.push({
      path: routePath,
      filePath,
      line: 1,
    });
  }
}
