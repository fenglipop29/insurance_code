import dotenv from 'dotenv';
import { createSkeletonApp } from './skeleton-c-v1/app.mjs';

dotenv.config();

const app = createSkeletonApp();
const PORT = Number(process.env.API_PORT || 4000);
const HOST = process.env.API_HOST || '127.0.0.1';

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`C API skeleton listening on http://${HOST}:${PORT}`);
});
