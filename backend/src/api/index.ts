import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { authMiddleware } from './middleware/auth.js';
import { auditContextMiddleware } from './middleware/audit.js';
import { handleError } from './utils/errors.js';
import { branchRoutes } from './routes/branches.js';
import { reviewRoutes } from './routes/reviews.js';
import { convergenceRoutes } from './routes/convergence.js';
import { auditRoutes } from './routes/audit.js';
import { authRoutes } from './routes/auth.js';
import { publicRoutes } from './routes/public.js';
import { usersRoutes } from './routes/users.js';
import { contentRoutes } from './routes/contents.js';
import { notificationRoutes } from './routes/notifications.js';
import { rebaseRoutes } from './routes/rebase.js';

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
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Set-Cookie'], // Explicitly expose cookie headers
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
      auth: '/api/v1/auth',
      branches: '/api/v1/branches',
      reviews: '/api/v1/reviews',
      convergence: '/api/v1/convergence',
      audit: '/api/v1/audit',
      public: '/api/v1/public',
      users: '/api/v1/users',
      contents: '/api/v1/contents',
      notifications: '/api/v1/notifications',
    },
  })
);

// Mount API routes
api.route('/auth', authRoutes);
api.route('/branches', branchRoutes);
api.route('/reviews', reviewRoutes);
api.route('/convergence', convergenceRoutes);
api.route('/audit', auditRoutes);
api.route('/public', publicRoutes);
api.route('/users', usersRoutes);
api.route('/contents', contentRoutes);
api.route('/notifications', notificationRoutes);
// Rebase routes are mounted on branches path for convenience
api.route('/branches', rebaseRoutes);

app.route('/api/v1', api);

export default app;
