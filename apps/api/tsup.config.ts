import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/index.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  sourcemap: true,
  noExternal: [/^@turf-and-taste\//],
  external: ['ws'],
});
