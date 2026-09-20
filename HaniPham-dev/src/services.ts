import {mockMedia,mockTributes} from './data';
import {collection} from './lib';
import type {BasketItem,MediaService,UploadService,DonationService,UploadInput,UploadSession} from './types';

// Only a deliberate 'mock' choice enables the demo; an invalid value fails visibly.
const source=import.meta.env.VITE_MEDIA_SOURCE||'mock';
if(source!=='mock'&&source!=='google-drive')throw new Error('Invalid VITE_MEDIA_SOURCE');
export const isDemo=source==='mock';
const base=import.meta.env.VITE_API_BASE||'/api';
async function api<T>(path:string,init?:RequestInit):Promise<T>{
 const r=await fetch(base+path,{...init,credentials:'same-origin'});
 if(!r.ok){let detail='';try{const payload=await r.json() as {error?:string};detail=payload.error||''}catch{}
  throw new Error(r.status===401?'Vui lòng đăng nhập bằng tài khoản Google được cấp quyền.':r.status===503?'Backend chưa được cấu hình.':detail||'Không thể kết nối. Vui lòng thử lại.');}
 return r.json() as Promise<T>;
}
let records=[...mockMedia];
let demoSession:UploadSession={authorized:false,expiresAt:'',demo:true};
const sessionValid=()=>demoSession.authorized&&Date.parse(demoSession.expiresAt)>Date.now();
const requireDemoSession=()=>{if(!sessionValid())throw new Error('Phiên demo đã hết hạn, vui lòng mở lại Tải lên.');};

export const media:MediaService=isDemo?{
 list:async()=>records.filter(x=>x.isPublished),
 get:async id=>records.find(x=>x.id===id&&x.isPublished),
 latest:async()=>collection(records).find((x):x is import('./types').Song=>x.type==='song'),
 popular:async()=>collection(records,'','popular') as import('./types').Song[],
 search:async q=>collection(records,q)
}:{
 list:()=>api('/media'),get:id=>api(`/media/${encodeURIComponent(id)}`),
 latest:()=>api('/media/latest'),popular:()=>api('/media/popular'),search:q=>api(`/media/search?q=${encodeURIComponent(q)}`)
};

export function validateUpload(x:UploadInput){
 if(!x.title.trim())throw new Error('Vui lòng nhập tên.');
 if(!['image/jpeg','image/png','image/webp'].includes(x.image?.type)||x.image.size>8*1024*1024||!x.image.size)throw new Error('Ảnh phải là JPG, PNG hoặc WebP, tối đa 8 MB.');
 if(x.type==='song'&&(!x.audio||!['audio/mpeg','audio/wav','audio/x-wav','audio/ogg','audio/mp4'].includes(x.audio.type)||x.audio.size>24*1024*1024||!x.audio.size))throw new Error('Chọn MP3, WAV, OGG hoặc M4A, tối đa 24 MB.');
}
export const uploads:UploadService=isDemo?{
 login:async()=>{demoSession={authorized:true,expiresAt:new Date(Date.now()+15*60*1000).toISOString(),demo:true};},
 session:async()=>({...demoSession,authorized:sessionValid()}),
 logout:async()=>{demoSession.authorized=false;},
 upload:async(input,progress)=>{
  requireDemoSession();validateUpload(input);progress(15);await new Promise(r=>setTimeout(r,200));progress(65);
  const item={id:crypto.randomUUID(),type:input.type,title:input.title.trim(),caption:input.caption,tags:input.tags,mood:input.mood,isPublished:input.isPublished,publishedAt:new Date().toISOString(),favoriteCount:0,imageUrl:URL.createObjectURL(input.image),...(input.type==='song'?{artist:input.artist||'Hani Pham',audioUrl:URL.createObjectURL(input.audio!),playCount:0}:{})} as BasketItem;
  records=[item,...records];progress(100);return item;
 },
 list:async()=>{requireDemoSession();return records.filter(i=>i.type!=='note');},
 edit:async(id,changes)=>{requireDemoSession();const existing=records.find(i=>i.id===id);if(!existing)throw new Error('Không tìm thấy');const updated={...existing,...changes} as BasketItem;records=records.map(i=>i.id===id?updated:i);return updated;},
 archive:async id=>{requireDemoSession();records=records.filter(i=>i.id!==id);}
}:{
 login:()=>{window.location.assign(`${base}/auth/google/start`);return Promise.resolve();},
 session:()=>api('/admin/session'),
 logout:()=>api('/admin/logout',{method:'POST'}).then(()=>undefined),
 upload:async(input,progress)=>{
  validateUpload(input);
  const body=new FormData();body.set('metadata',JSON.stringify({...input,image:undefined,audio:undefined}));body.set('image',input.image);if(input.audio)body.set('audio',input.audio);
  return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST',`${base}/admin/upload/${input.type}`);xhr.withCredentials=true;
   xhr.upload.onprogress=e=>{if(e.lengthComputable)progress(Math.min(99,e.loaded/e.total*100));};
   xhr.onerror=()=>reject(new Error('Mất kết nối. Vui lòng thử lại.'));
   xhr.onload=()=>{try{if(xhr.status<200||xhr.status>=300){let error='Tải lên thất bại hoặc phiên đã hết hạn.';try{error=(JSON.parse(xhr.responseText) as {error?:string}).error||error}catch{}throw new Error(error)}progress(100);resolve(JSON.parse(xhr.responseText) as BasketItem)}catch(e){reject(e)}};
   xhr.send(body);
  });
 },
 list:()=>api('/admin/media'),
 edit:(id,changes)=>api(`/admin/media/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(changes)}),
 archive:async id=>{await api(`/admin/media/${encodeURIComponent(id)}`,{method:'DELETE'});}
};
export const donations:DonationService={tributes:()=>isDemo?Promise.resolve(mockTributes):api('/tributes'),checkout:async()=>{const url=import.meta.env.VITE_PAYMENT_URL;if(url&&new URL(url).protocol==='https:')return url;throw new Error('Sắp có — Hani đang chuẩn bị góc cà phê này.')}};
