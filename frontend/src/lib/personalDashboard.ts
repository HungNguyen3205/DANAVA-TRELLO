import api from './axios';
import { useAuthStore } from '../store/authStore';

const inFlight = new Map<string, Promise<any>>();
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export function getPersonalDashboard(force = false): Promise<any> {
  const token = useAuthStore.getState().token || localStorage.getItem('auth_token');
  if (!token) return Promise.reject(new Error('Not authenticated'));

  if (!force) {
    const cached = cache.get(token);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return Promise.resolve(cached.data);
    }
  }

  const existing = inFlight.get(token);
  if (existing) return existing;

  const request = api.get('/me/dashboard').then(({ data }) => {
    cache.set(token, { data, timestamp: Date.now() });
    return data;
  });
  
  inFlight.set(token, request);
  void request.finally(() => {
    if (inFlight.get(token) === request) inFlight.delete(token);
  }).catch(() => {});
  
  return request;
}

export function clearPersonalDashboardCache() {
  cache.clear();
  inFlight.clear();
}
