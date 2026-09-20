import type { Env } from './types';
import { HttpError, json, requireOrigin, requireDatabase } from './http';
import { login, callback, logout, session, owner } from './auth';
import { adminRoute } from './routes/admin';
import { publicRoute } from './routes/media';
export { publicMedia } from './repository';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const { pathname, origin } = new URL(request.url);
      if (!pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : json({error: 'Not found'}, 404);
      if (pathname === '/api/auth/google/start' && request.method === 'GET') return await login(request, env);
      if (pathname === '/api/auth/google/callback' && request.method === 'GET') return await callback(request, env);
      if (pathname === '/api/admin/session' && request.method === 'GET') return await session(request, env);
      if (pathname.startsWith('/api/media') && ['GET', 'HEAD'].includes(request.method)) return await publicRoute(request, env);
      if (pathname === '/api/tributes' && request.method === 'GET') {
        const db = requireDatabase(env.DB);
        const {results} = await db.prepare("SELECT id, display_name, anonymous, message, timestamp FROM tributes WHERE visibility = 'approved' AND payment_verified = 1 ORDER BY timestamp DESC LIMIT 50").all<{id:string;display_name:string;anonymous:number;message:string;timestamp:string}>();
        return json(results.map(row => ({id:row.id, displayName:row.display_name, anonymous:row.anonymous===1, message:row.message, timestamp:row.timestamp, visibility:'approved', demo:false})));
      }
      if (pathname === '/api/donations/checkout') return json({error:'Payment provider not configured'}, 503);
      if (pathname === '/api/admin/logout' && request.method === 'POST') { requireOrigin(request, env.SITE_ORIGIN ?? origin); return await logout(request, env); }
      if (pathname.startsWith('/api/admin/')) {
        if (request.method !== 'GET') requireOrigin(request, env.SITE_ORIGIN ?? origin);
        return await adminRoute(request, env);
      }
      if (pathname === '/api/auth/google/start' || pathname === '/api/auth/google/callback') return json({error:'Method not allowed'}, 405);
      return json({error:'Not found'}, 404);
    } catch (error) {
      if (error instanceof HttpError) return json({error:error.message}, error.status);
      // Do not leak credentials, internal Google details or SQL in public errors.
      return json({error:'Unexpected service error'}, 500);
    }
  }
};
