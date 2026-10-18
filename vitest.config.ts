import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setupEnv.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      APP_SECRET_SALT: 'unit-test-only-salt-placeholder-value',
      SLACK_SIGNING_SECRET: 'unit-test-only-signing-placeholder',
      SLACK_BOT_TOKEN: ['xoxb', 'test', 'default', 'token'].join('-'),
    },
  },
});
