import { authOptional, authRequired } from '../common/middleware.mjs';
import { tenantContext } from '../common/access-control.mjs';
import { appendPoints, getBalance, getState, nextId, persistState } from '../common/state.mjs';
import { canAccessTemplate } from '../common/template-visibility.mjs';

function mediaToUrl(mediaItem) {
  if (!mediaItem) return '';
  if (typeof mediaItem === 'string') return mediaItem;
  return String(mediaItem.preview || mediaItem.url || mediaItem.path || mediaItem.name || '');
}

function extractMediaUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text) || /^\/uploads\//i.test(text)) return text;
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object') return String(first.preview || first.url || first.path || first.name || '');
    } catch {
      return '';
    }
  }
  return '';
}

function toAbsoluteUrl(req, url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith('/')) return raw;
  return `${req.protocol}://${req.get('host')}${raw}`;
}

function looksLikeMediaUrl(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  return (
    /^\/uploads\//i.test(raw) ||
    /^https?:\/\/.+\.(png|jpe?g|gif|webp|bmp|svg|mp4|mov|m4v|webm)(\?.*)?$/i.test(raw) ||
    /\.(png|jpe?g|gif|webp|bmp|svg|mp4|mov|m4v|webm)$/i.test(raw)
  );
}

function normalizeCourse(req, course = {}) {
  const media = Array.isArray(course.media) ? course.media : [];
  const imageRaw = mediaToUrl(media[0]) || extractMediaUrl(course.image) || '';
  const image = toAbsoluteUrl(req, imageRaw);
  const contentType = String(course.contentType || course.type || 'article').toLowerCase();
  const type = contentType === 'video' ? 'video' : contentType === 'comic' ? 'comic' : 'article';
  const typeLabel = type === 'video' ? '视频' : type === 'comic' ? '图文' : '文章';
  const videoMedia = media.find((m) => {
    if (typeof m === 'string') return /\.(mp4|mov|m4v|webm)$/i.test(m);
    const t = String(m?.type || '').toLowerCase();
    const n = String(m?.name || m?.url || m?.preview || '').toLowerCase();
    return t.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(n);
  });
  return {
    ...course,
    desc:
      String(course.desc || course.description || '').trim() ||
      (looksLikeMediaUrl(course.content) ? '' : String(course.content || '').slice(0, 56)),
    type,
    typeLabel,
    progress: Number(course.progress || 0),
    timeLeft: String(course.timeLeft || (type === 'video' ? '约 10 分钟' : '约 5 分钟')),
    action: String(course.action || '开始学习'),
    color: String(course.color || 'bg-blue-500/90'),
    btnColor: String(course.btnColor || 'bg-blue-500 text-white'),
    image: image || `https://picsum.photos/seed/course${course.id || 0}/800/450`,
    media: media.map((m) => {
      if (typeof m === 'string') return toAbsoluteUrl(req, m);
      if (!m || typeof m !== 'object') return m;
      return {
        ...m,
        preview: toAbsoluteUrl(req, m.preview || ''),
        url: toAbsoluteUrl(req, m.url || ''),
        path: toAbsoluteUrl(req, m.path || ''),
      };
    }),
    videoUrl: mediaToUrl(videoMedia),
    points: Number(course.points || 0),
    content: String(course.content || ''),
  };
}

export function registerLearningRoutes(app) {
  app.get('/api/learning/courses', authOptional, tenantContext, (req, res) => {
    const state = getState();
    const isEffective = (row) => {
      const status = String(row?.status || '').toLowerCase();
      if (!status) return true;
      return ['active', 'online', 'published', 'ongoing', 'on', '进行中', '生效'].includes(status);
    };
    const visibleCourses = (state.learningCourses || [])
      .filter((course) => (String(req.actor?.actorType || '') === 'employee' ? true : isEffective(course)) && canAccessTemplate(state, req.actor, course))
      .map((course) => ({
        ...normalizeCourse(req, course),
        status:
          String(req.actor?.actorType || '') === 'employee' && String(course.creatorRole || '') === 'platform_admin'
            ? 'inactive'
            : course.status,
        isPlatformTemplate: Boolean(
          course.platformTemplate || Number(course.sourceTemplateId || 0) > 0 || String(course.creatorRole || '') === 'platform_admin'
        ),
        templateTag:
          course.platformTemplate || Number(course.sourceTemplateId || 0) > 0 || String(course.creatorRole || '') === 'platform_admin'
            ? '平台模板'
            : '',
      }));
    const categories = new Set(['全部', ...visibleCourses.map((c) => c.category)]);
    return res.json({
      categories: [...categories],
      courses: [...visibleCourses].sort((a, b) => a.id - b.id),
    });
  });

  app.get('/api/learning/courses/:id', authOptional, tenantContext, (req, res) => {
    const state = getState();
    const id = Number(req.params.id);
    const source = state.learningCourses.find((c) => c.id === id && canAccessTemplate(state, req.actor, c));
    const course = source ? normalizeCourse(req, source) : null;
    if (!course) {
      return res.status(404).json({ code: 'COURSE_NOT_FOUND', message: '课程不存在' });
    }
    return res.json({ course });
  });

  app.post('/api/learning/courses/:id/complete', authRequired, (req, res) => {
    const state = getState();
    const id = Number(req.params.id);
    const course = state.learningCourses.find((c) => c.id === id);
    if (!course) {
      return res.status(404).json({ code: 'COURSE_NOT_FOUND', message: '课程不存在' });
    }

    const exists = state.courseCompletions.find((x) => x.userId === req.user.id && x.courseId === id);
    if (exists) {
      return res.json({
        ok: true,
        duplicated: true,
        reward: 0,
        balance: getBalance(req.user.id),
        message: '该课程已领取过积分',
      });
    }

    state.courseCompletions.push({
      id: nextId(state.courseCompletions),
      userId: req.user.id,
      courseId: id,
      pointsAwarded: course.points,
      createdAt: new Date().toISOString(),
    });
    appendPoints(req.user.id, 'earn', course.points, 'course_complete', String(id), `完成课程 ${course.title}`);
    persistState();

    return res.json({
      ok: true,
      duplicated: false,
      reward: course.points,
      balance: getBalance(req.user.id),
    });
  });

  app.get('/api/learning/games', (_req, res) => {
    const state = getState();
    return res.json({ games: [...state.learningGames].sort((a, b) => a.id - b.id) });
  });

  app.get('/api/learning/tools', (_req, res) => {
    const state = getState();
    return res.json({ tools: [...state.learningTools].sort((a, b) => a.id - b.id) });
  });
}
