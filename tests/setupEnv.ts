process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.APP_SECRET_SALT = 'unit-test-only-salt-placeholder-value';
process.env.SLACK_SIGNING_SECRET = 'unit-test-only-signing-placeholder';
process.env.SLACK_BOT_TOKEN = ['xoxb', 'test', 'default', 'token'].join('-');
