import { mkdir, rm, writeFile } from 'node:fs/promises'

import { build } from 'esbuild'

const outputDirectory = 'dist-agentcore'

await rm(outputDirectory, { recursive: true, force: true })
await mkdir(outputDirectory, { recursive: true })

await build({
  entryPoints: ['src/agentcore-server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: `${outputDirectory}/app.js`,
  sourcemap: true,
  logLevel: 'info',
  // Strands ships an optional S3 context-offloader plugin. Keeper does not enable
  // that plugin, so its dynamic client import must not silently become a runtime
  // dependency or an undeclared capability of this competition bundle.
  external: ['@aws-sdk/client-s3'],
})

await writeFile(
  `${outputDirectory}/package.json`,
  `${JSON.stringify({ name: 'telltend-keeper-agentcore-bundle', private: true, type: 'commonjs' }, null, 2)}\n`,
  'utf8',
)
