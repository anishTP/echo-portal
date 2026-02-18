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
import { uploadRoutes } from './routes/uploads.js';
import { comparisonRoutes } from './routes/comparison.js';
import { aiRoutes } from './routes/ai.js';
import { aiConfigRoutes } from './routes/ai-config.js';
import { aiContextDocRoutes } from './routes/ai-context-documents.js';
import { categoryRoutes } from './routes/categories.js';
import { subcategoryRoutes } from './routes/subcategories.js';
import { EchoProvider } from '../services/ai/providers/echo-provider.js';
import { AnthropicProvider } from '../services/ai/providers/anthropic-provider.js';
import { OpenAIProvider } from '../services/ai/providers/openai-provider.js';
import { providerRegistry } from '../services/ai/provider-registry.js';

// Register AI providers — first configured provider wins as default
if (process.env.OPENAI_API_KEY) {
  providerRegistry.register(new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || undefined,
  }));
  console.log('[AI] OpenAI provider registered (model: %s)', process.env.OPENAI_MODEL || 'gpt-4o');
} else if (process.env.ANTHROPIC_API_KEY) {
  providerRegistry.register(new AnthropicProvider({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || undefined,
  }));
  console.log('[AI] Anthropic provider registered (model: %s)', process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514');
} else {
  providerRegistry.register(new EchoProvider());
  console.log('[AI] Echo (dev) provider registered — set OPENAI_API_KEY or ANTHROPIC_API_KEY for real AI');
}

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
api.route('/uploads', uploadRoutes);
// Comparison routes for in-context review (006-review-approval)
api.route('/', comparisonRoutes);
// AI-assisted authoring routes (007-ai-assisted-authoring)
api.route('/ai', aiRoutes);
// AI admin configuration routes (007-ai-assisted-authoring Phase 2)
api.route('/ai/config', aiConfigRoutes);
// AI context documents CRUD routes (admin-only)
api.route('/ai/context-documents', aiContextDocRoutes);
// Category management routes
api.route('/categories', categoryRoutes);
// Subcategory management routes (011-sidebar-content-hierarchy)
api.route('/subcategories', subcategoryRoutes);

app.route('/api/v1', api);

// --- Static file serving for production (frontend SPA) ---
if (process.env.NODE_ENV === 'production') {
  const { serveStatic } = await import('@hono/node-server/serve-static');
  const frontendDir = process.env.FRONTEND_DIR || '../frontend/dist';

  // Serve static assets (JS, CSS, images, etc.)
  app.use('/*', serveStatic({ root: frontendDir }));

  // SPA fallback: serve index.html for any non-API, non-file route
  app.get('*', serveStatic({ root: frontendDir, path: 'index.html' }));
}

export default app;
