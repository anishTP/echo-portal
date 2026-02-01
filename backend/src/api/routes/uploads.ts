import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const uploadRoutes = new Hono();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

async function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * POST /api/v1/uploads/image - Upload an image file
 * Accepts multipart/form-data with 'file' field
 * Returns the URL to access the uploaded image
 */
uploadRoutes.post('/image', requireAuth, async (c) => {
  try {
    await ensureUploadsDir();

    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || !(file instanceof File)) {
      return c.json({ error: { code: 'NO_FILE', message: 'No file provided' } }, 400);
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return c.json({ error: { code: 'INVALID_TYPE', message: 'File must be an image' } }, 400);
    }

    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return c.json({ error: { code: 'FILE_TOO_LARGE', message: 'File must be less than 10MB' } }, 400);
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png';
    const filename = `${randomUUID()}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    // Write file to disk
    const buffer = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(buffer));

    // Return URL (relative to API base)
    const url = `/api/v1/uploads/${filename}`;

    return c.json({
      data: {
        url,
        filename,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: { code: 'UPLOAD_FAILED', message: 'Failed to upload file' } }, 500);
  }
});

/**
 * GET /api/v1/uploads/:filename - Serve uploaded file
 */
uploadRoutes.get('/:filename', async (c) => {
  const { filename } = c.req.param();

  // Sanitize filename to prevent directory traversal
  const sanitized = path.basename(filename);
  const filepath = path.join(UPLOADS_DIR, sanitized);

  if (!existsSync(filepath)) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'File not found' } }, 404);
  }

  // Read and serve file
  const { readFile } = await import('fs/promises');
  const buffer = await readFile(filepath);

  // Determine content type from extension
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };

  const contentType = contentTypes[ext] || 'application/octet-stream';

  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
    },
  });
});

export { uploadRoutes };
