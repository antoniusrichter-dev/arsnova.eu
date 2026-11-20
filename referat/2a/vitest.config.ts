/**
 * Versuchscode Referat Thema 2 / Auftrag 2A – kein Produktpfad.
 * Eigene Vitest-Konfiguration, damit die Produktkonfigurationen unverändert bleiben.
 *
 * Aufruf (Repo-Root):
 *   npx vitest run --config referat/2a/vitest.config.ts
 */
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  root: repoRoot,
  test: {
    environment: 'node',
    include: ['referat/2a/**/*.test.ts'],
    // Tests schreiben Evidenzdateien; nacheinander laufen lassen.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@arsnova/shared-types': path.resolve(repoRoot, 'libs/shared-types/src/index.ts'),
    },
  },
});
