import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { permissionRequired, tenantContext } from '../common/access-control.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '../../data/uploads');

function extFromMime(mime = '') {
  const normalized = String(mime || '').toLowerCase().trim();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('bmp')) return 'bmp';
  if (normalized.includes('svg')) return 'svg';
  if (normalized.includes('mp4')) return 'mp4';
  if (normalized.includes('quicktime')) return 'mov';
  if (normalized.includes('webm')) return 'webm';
  return 'bin';
}

function safeBaseName(name = '') {
  return String(name || '')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
}

function parseDataUrl(dataUrl = '') {
  const raw = String(dataUrl || '').trim();
  const match = raw.match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match) return null;
  return {
    mime: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function buildPublicUrl(req, relPath) {
  const protocol = String(req.headers['x-forwarded-proto'] || req.protocol || 'http');
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '127.0.0.1:4000');
  return `${protocol}://${host}/uploads/${relPath.replaceAll(path.sep, '/')}`;
}

export function registerUploadsRoutes(app) {
  app.post('/api/uploads/base64', tenantContext, permissionRequired('customer:write'), async (req, res) => {
    try {
      const tenantId = Number(req.tenantContext?.tenantId || 0);
      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json({ code: 'TENANT_CONTEXT_REQUIRED', message: '缺少租户上下文' });
      }
      const dataUrl = String(req.body?.dataUrl || '');
      const parsed = parseDataUrl(dataUrl);
      if (!parsed) return res.status(400).json({ code: 'INVALID_DATA_URL', message: '上传内容格式错误' });

      const sizeLimit = 12 * 1024 * 1024;
      if (parsed.buffer.length > sizeLimit) {
        return res.status(413).json({ code: 'FILE_TOO_LARGE', message: '文件过大，单文件最大 12MB' });
      }

      const mime = String(req.body?.type || parsed.mime || 'application/octet-stream');
      const ext = extFromMime(mime);
      const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
      const baseName = safeBaseName(req.body?.name || 'upload');
      const fileName = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}_${baseName}.${ext}`;
      const relDir = path.join(`tenant_${tenantId}`, datePart);
      const absDir = path.join(uploadsRoot, relDir);
      await fs.mkdir(absDir, { recursive: true });
      const relPath = path.join(relDir, fileName);
      const absPath = path.join(uploadsRoot, relPath);
      await fs.writeFile(absPath, parsed.buffer);

      return res.json({
        ok: true,
        file: {
          name: String(req.body?.name || fileName),
          type: mime,
          size: parsed.buffer.length,
          path: `/uploads/${relPath.replaceAll(path.sep, '/')}`,
          url: buildPublicUrl(req, relPath),
        },
      });
    } catch (err) {
      return res.status(500).json({ code: 'UPLOAD_FAILED', message: err?.message || '上传失败' });
    }
  });
}
