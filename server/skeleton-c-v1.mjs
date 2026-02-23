import dotenv from 'dotenv';
import { createSkeletonApp } from './skeleton-c-v1/app.mjs';
import { closeState, getStorageBackend, initializeState } from './skeleton-c-v1/common/state.mjs';

dotenv.config();

const PORT = Number(process.env.API_PORT || 4000);
const HOST = process.env.API_HOST || '127.0.0.1';

async function main() {
  await initializeState();

  const app = createSkeletonApp();
  const server = app.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`C API skeleton listening on http://${HOST}:${PORT} (storage=${getStorageBackend()})`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await closeState();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] bootstrap failed:', err?.message || err);
  process.exit(1);
});
