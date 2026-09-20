import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from '../server/worker';
import type { Database, Statement, Env } from '../server/types';

class SessionDb implements Database {
  rows = new Map<string, {email: string; google_sub: string; expires_at: number}>();
  prepare(sql: string): Statement {
    const values: (string | number | null)[] = [];
    const state = this;
    return {
      bind(...args) { values.push(...args); return this; },
      async run() {
        if(sql.startsWith('INSERT INTO admin_sessions')) state.rows.set(String(values[0]), {google_sub:String(values[1]),email:String(values[2]),expires_at:Number(values[3])});
        if(sql.startsWith('DELETE FROM admin_sessions')) state.rows.delete(String(values[0]));
        return {};
      },
      async first<T>() { return (sql.includes('FROM admin_sessions') ? state.rows.get(String(values[0])) ?? null : null) as T|null; },
      async all<T>() { return {results: [] as T[]}; }
    };
  }
}
const origin = 'https://hanipham.quainhon.com';
function cookieHeader(response: Response, name: string) { return response.headers.getSetCookie().find(value=>value.startsWith(name+'='))?.split(';')[0] ?? ''; }
afterEach(()=>vi.unstubAllGlobals());

describe('allowlisted Google owner sign-in',()=>{
  it('accepts only verified intended identity, and logout revokes server session',async()=>{
    const db = new SessionDb();
    const env: Env = {DB:db,SITE_ORIGIN:origin,GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',OWNER_GOOGLE_EMAIL:'owner@example.com'};
    let identity = {email:'intruder@example.com',email_verified:true,sub:'other-sub'};
    vi.stubGlobal('fetch',vi.fn(async (url:string)=>url.includes('/token')?Response.json({access_token:'fake'}):Response.json(identity)));
    async function roundTrip() {
      const start=await worker.fetch(new Request(origin+'/api/auth/google/start'),env);
      const state=new URL(start.headers.get('Location')!).searchParams.get('state');
      return worker.fetch(new Request(origin+'/api/auth/google/callback?code=mock-code&state='+state,{headers:{Cookie:cookieHeader(start,'hani_google_oauth')}}),env);
    }
    const refused=await roundTrip();
    expect(cookieHeader(refused,'hani_owner_session')).toBe('');
    identity={email:'owner@example.com',email_verified:true,sub:'owner-sub'};
    const accepted=await roundTrip();
    const cookie=cookieHeader(accepted,'hani_owner_session');
    expect(cookie).not.toBe('');
    const check=await worker.fetch(new Request(origin+'/api/admin/session',{headers:{Cookie:cookie}}),env);
    expect((await check.json() as {authorized:boolean}).authorized).toBe(true);
    const logout=await worker.fetch(new Request(origin+'/api/admin/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin}}),env);
    expect(logout.status).toBe(200);
    const old=await worker.fetch(new Request(origin+'/api/admin/session',{headers:{Cookie:cookie}}),env);
    expect((await old.json() as {authorized:boolean}).authorized).toBe(false);
  });
  it('rejects unverified Google email, even when it matches owner',async()=>{
    const db=new SessionDb();
    const env: Env={DB:db,SITE_ORIGIN:origin,GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',OWNER_GOOGLE_EMAIL:'owner@example.com'};
    vi.stubGlobal('fetch',vi.fn(async (url:string)=>url.includes('/token')?Response.json({access_token:'fake'}):Response.json({email:'owner@example.com',email_verified:false,sub:'owner-sub'})));
    const start=await worker.fetch(new Request(origin+'/api/auth/google/start'),env);
    const state=new URL(start.headers.get('Location')!).searchParams.get('state');
    const result=await worker.fetch(new Request(origin+'/api/auth/google/callback?code=fake&state='+state,{headers:{Cookie:cookieHeader(start,'hani_google_oauth')}}),env);
    expect(cookieHeader(result,'hani_owner_session')).toBe('');
  });
});
