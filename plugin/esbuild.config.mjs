import esbuild from 'esbuild';

const isProd = process.argv[2] === 'production';

const banner =
  '/* MermaidFlow Animator — Obsidian plugin\n' +
  ' * https://github.com/VivaldiCode/mermaid-flow-animator\n' +
  ' */';

const ctx = await esbuild.context({
  entryPoints: ['main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
  ],
  format: 'cjs',
  target: 'es2020',
  logLevel: 'info',
  sourcemap: isProd ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  minify: isProd,
  banner: { js: banner },
});

if (isProd) {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('✓ Plugin built (production)');
} else {
  await ctx.watch();
  console.log('✓ Plugin watching for changes');
}
