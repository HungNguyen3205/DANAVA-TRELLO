import api from './axios';
import { useAuthStore } from '../store/authStore';

// Share only requests that are currently in flight. Never reuse a previous
// account's dashboard or keep a stale result after a mutation.
const inFlight = new Map<string, Promise<any>>();

export function getPersonalDashboard(): Promise<any> {
  const token = useAuthStore.getState().token || localStorage.getItem('auth_token');
  if (!token) return Promise.reject(new Error('Not authenticated'));

  const existing = inFlight.get(token);
  if (existing) return existing;

  const request = api.get('/me/dashboard').then(({ data }) => data);
  inFlight.set(token, request);
  void request.finally(() => {
    if (inFlight.get(token) === request) inFlight.delete(token);
  }).catch(() => {});
  return request;
}
