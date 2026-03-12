import * as vscode from 'vscode';

export class Scanner {
  async scan(): Promise<string[]> {
    const config = vscode.workspace.getConfiguration('codeAtlas');
    const includePatterns = config.get<string[]>('include', [
      '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
    ]);
    const excludePatterns = config.get<string[]>('exclude', [
      '**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**',
    ]);
    const maxFiles = config.get<number>('maxFiles', 1000);

    const includeGlob = `{${includePatterns.join(',')}}`;
    const excludeGlob = `{${excludePatterns.join(',')}}`;

    const uris = await vscode.workspace.findFiles(includeGlob, excludeGlob, maxFiles);
    return uris.map(uri => uri.fsPath).sort();
  }
}
