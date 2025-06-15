import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: true,
  shims: true,
  clean: true,
  sourcemap: true,
});