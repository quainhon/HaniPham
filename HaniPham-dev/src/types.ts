export type MediaSource = 'mock' | 'google-drive';
export interface BaseMedia { id:string; title:string; caption:string; tags:string[]; mood:string[]; publishedAt:string; isPublished:boolean; imageUrl:string; favoriteCount:number }
export interface Song extends BaseMedia { type:'song'; artist:string; durationSec?:number; audioUrl?:string; playCount:number }
export interface Photo extends BaseMedia { type:'photo' }
export interface Note extends BaseMedia { type:'note' }
export type BasketItem = Song | Photo | Note;
export interface DonationTribute { id:string; displayName:string; anonymous:boolean; message:string; timestamp:string; visibility:'approved'|'hidden'; demo:boolean }
export interface UploadSession { authorized:boolean; expiresAt:string; demo:boolean; ownerEmail?:string }
export interface UploadInput { type:'song'|'photo'; title:string; artist:string; caption:string; tags:string[]; mood:string[]; isPublished:boolean; image:File; audio?:File }
export interface UploadEdit { title?:string; caption?:string; artist?:string; tags?:string[]; mood?:string[]; isPublished?:boolean }
export interface MediaService { list():Promise<BasketItem[]>; get(id:string):Promise<BasketItem|undefined>; latest():Promise<Song|undefined>; popular():Promise<Song[]>; search(query:string):Promise<BasketItem[]> }
export interface UploadService { login():Promise<void>; session():Promise<UploadSession>; logout():Promise<void>; upload(input:UploadInput,onProgress:(percent:number)=>void):Promise<BasketItem>; list():Promise<BasketItem[]>; edit(id:string,changes:UploadEdit):Promise<BasketItem>; archive(id:string):Promise<void> }
export interface DonationService { tributes():Promise<DonationTribute[]>; checkout():Promise<string> }
