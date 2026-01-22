import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { authMiddleware } from './middleware/auth.js';
import { auditContextMiddleware } from './middleware/audit.js';
import { handleError } from './utils/errors.js';
import { branchRoutes } from './routes/branches.js';

// Create Hono app
const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use('*', auditContextMiddleware);
app.use('*', authMiddleware);

// Global error handler
app.onError(handleError);

// Health check
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.0.1',
  })
);

// API version prefix
const api = new Hono();

// API root
api.get('/', (c) =>
  c.json({
    message: 'Echo Portal API v1',
    version: '0.0.1',
    endpoints: {
      health: '/health',
      branches: '/api/v1/branches',
      reviews: '/api/v1/reviews',
      convergence: '/api/v1/convergence',
      audit: '/api/v1/audit',
    },
  })
);

// Mount API routes
api.route('/branches', branchRoutes);
// TODO: Mount review routes
// TODO: Mount convergence routes
// TODO: Mount audit routes

app.route('/api/v1', api);

export default app;
