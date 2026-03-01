export function registerHealthRoutes(app) {
  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'insurance-api' }));
}
