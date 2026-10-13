'use strict';

// Loads GEOAPIFY_API_KEY (and PORT) from .env. The key stays on the server and
// is never returned to clients or embedded in the mobile app.
require('dotenv').config();

const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3001;
// 0.0.0.0 so a physical device on the same network can reach the dev machine.
const HOST = process.env.HOST || '0.0.0.0';

const app = createApp();

const server = app.listen(PORT, HOST, () => {
  const keyConfigured =
    typeof process.env.GEOAPIFY_API_KEY === 'string' &&
    process.env.GEOAPIFY_API_KEY.trim() !== '';

  console.log(`[server] listening on http://${HOST}:${PORT}`);
  if (keyConfigured) {
    console.log('[server] GEOAPIFY_API_KEY is configured.');
  } else {
    console.warn(
      '[server] GEOAPIFY_API_KEY is missing. Restaurant search will return 503 until it is set in .env.'
    );
  }
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = server;
