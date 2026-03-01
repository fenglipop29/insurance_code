import { api } from './api';

export function trackCEvent(event: string, properties: Record<string, unknown> = {}) {
  api.trackEvent({ event, properties }).catch(() => undefined);
}
