import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './api/index.js';

const port = parseInt(process.env.PORT || '3001', 10);

console.log(`Starting Echo Portal API server on port ${port}`);
console.log('[ENV] Environment variables loaded:', {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ? 'SET' : 'NOT SET',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET',
  FRONTEND_URL: process.env.FRONTEND_URL || 'NOT SET',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'NOT SET',
});

serve({
  fetch: app.fetch,
  port,
});

console.log(`Server running at http://localhost:${port}`);

export default app;
