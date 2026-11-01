import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    fileParallelism: false, // las pruebas comparten una sola base de datos
    testTimeout: 15000,
    env: {
      TEST_DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? 'postgres://vetaroja@127.0.0.1:54329/veta_roja_test',
    },
  },
});
