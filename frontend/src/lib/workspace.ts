import api from './axios';

const inFlight = new Map<string, Promise<any>>();
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 3 * 60 * 1000;

export function getWorkspaces(force = false): Promise<any> {
  const url = '/workspaces';
  if (!force) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return Promise.resolve(cached.data);
    }
  }

  const existing = inFlight.get(url);
  if (existing) return existing;

  const request = api.get(url).then(({ data }) => {
    cache.set(url, { data, timestamp: Date.now() });
    return data;
  });
  
  inFlight.set(url, request);
  void request.finally(() => {
    if (inFlight.get(url) === request) inFlight.delete(url);
  }).catch(() => {});
  
  return request;
}

export function clearWorkspaceCache() {
  cache.clear();
  inFlight.clear();
}
