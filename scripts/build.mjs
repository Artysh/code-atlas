import { build, context } from 'esbuild';

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !isProduction,
  minify: isProduction,
  treeShaking: true,
};

/** @type {import('esbuild').BuildOptions} */
const webviewConfig = {
  entryPoints: ['webview-ui/main.ts'],
  bundle: true,
  outfile: 'dist/webview.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  sourcemap: !isProduction,
  minify: isProduction,
  treeShaking: true,
};

async function main() {
  if (isWatch) {
    const extCtx = await context(extensionConfig);
    const webCtx = await context(webviewConfig);
    await Promise.all([extCtx.watch(), webCtx.watch()]);
    console.log('[code-atlas] Watching for changes...');
  } else {
    await Promise.all([
      build(extensionConfig),
      build(webviewConfig),
    ]);
    console.log('[code-atlas] Build complete');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
