import {useEffect,useState} from 'react';
import {LockKeyhole,UploadCloud} from 'lucide-react';
import {Modal} from './Modal';
import {isDemo,uploads} from './services';
import type {BasketItem} from './types';

export function Upload({onClose,onAdded}:{onClose:()=>void;onAdded:()=>void}){
 const [authorized,setAuthorized]=useState(false),[checking,setChecking]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[success,setSuccess]=useState(''),[kind,setKind]=useState<'song'|'photo'>('song'),[managed,setManaged]=useState<BasketItem[]>([]),[ownerEmail,setOwnerEmail]=useState('');
 const load=async()=>{const current=await uploads.session();setAuthorized(current.authorized);setOwnerEmail(current.ownerEmail||'');if(current.authorized)setManaged(await uploads.list());};
 useEffect(()=>{let active=true;const params=new URLSearchParams(window.location.search);const failure=params.get('auth_error');if(failure)setError(failure);if(params.has('auth_error')||params.has('upload')){params.delete('auth_error');params.delete('upload');window.history.replaceState(null,'',window.location.pathname+(params.toString()?'?'+params:'')+window.location.hash)};
  uploads.session().then(async s=>{if(!active)return;setAuthorized(s.authorized);setOwnerEmail(s.ownerEmail||'');if(s.authorized){const list=await uploads.list();if(active)setManaged(list);}}).catch(e=>{if(active)setError((e as Error).message)}).finally(()=>{if(active)setChecking(false)});
  return()=>{active=false};
 },[]);
 const submitEdit=async(item:BasketItem)=>{setError('');setSuccess('');setBusy(true);try{await uploads.edit(item.id,{isPublished:!item.isPublished});await load();onAdded();}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const editDetails=async(item:BasketItem)=>{const title=window.prompt('Tên / tiêu đề mới:',item.title);if(title===null)return;const caption=window.prompt('Lời nhắn mới:',item.caption);if(caption===null)return;setError('');setBusy(true);try{await uploads.edit(item.id,{title,caption});await load();onAdded();setSuccess('Đã cập nhật thông tin.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const archive=async(item:BasketItem)=>{if(!window.confirm(`Ẩn “${item.title}” khỏi thư viện? Tệp Drive sẽ được giữ nguyên.`))return;setError('');setBusy(true);try{await uploads.archive(item.id);await load();onAdded();}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 return <Modal title={authorized?'Gửi một kỷ niệm':'Chỉ Hani được tải lên'} onClose={onClose}>
  <div className="upload-symbol"><LockKeyhole/></div>
  {isDemo&&<p className="notice">Chế độ DEMO · Đăng nhập mô phỏng, KHÔNG dùng tài khoản Google. Tệp chỉ tồn tại trong phiên này và không lên Google Drive.</p>}
  {checking?<p role="status">Đang kiểm tra phiên quản lý…</p>:!authorized?<div className="upload-signin"><p>Chỉ tài khoản Google được chủ sở hữu cho phép mới có thể tải bài hát, ảnh và quản lý thư viện. Người nghe không cần đăng nhập.</p><div className="actions"><button type="button" onClick={onClose}>Đóng</button><button type="button" className="primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await uploads.login();if(isDemo){await load()}}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>{isDemo?'Thử giao diện quản lý':'Đăng nhập bằng Google'}</button></div></div>:
  <><p className="notice">{isDemo?'Phiên quản lý mô phỏng · không lưu lên cloud':`Đã đăng nhập: ${ownerEmail||'tài khoản quản lý'}`}</p><form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const d=new FormData(form);setBusy(true);setError('');setSuccess('');setProgress(0);try{await uploads.upload({type:kind,title:String(d.get('title')||''),artist:String(d.get('artist')||'Hani Pham'),caption:String(d.get('caption')||''),tags:String(d.get('tags')||'').split(',').map(s=>s.trim()).filter(Boolean),mood:String(d.get('mood')||'').split(',').map(s=>s.trim()).filter(Boolean),isPublished:d.get('status')==='published',image:d.get('image') as File,audio:kind==='song'?d.get('audio') as File:undefined},setProgress);setSuccess(d.get('status')==='published'?'Đã thêm vào rổ kỷ niệm.':'Đã lưu bản nháp.');form.reset();onAdded();await load();}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>
   <label>Loại kỷ niệm<select value={kind} onChange={e=>setKind(e.target.value as 'song'|'photo')}><option value="song">Bài hát</option><option value="photo">Ảnh</option></select></label>
   <label>Tên / tiêu đề<input name="title" required maxLength={150}/></label>
   {kind==='song'&&<><label>Nghệ sĩ<input name="artist" defaultValue="Hani Pham"/></label><label>Âm thanh · tối đa 24 MB<input name="audio" type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4" required/></label></>}
   <label>Ảnh {kind==='song'?'bìa':''} · tối đa 8 MB<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required/></label>
   <label>Lời nhắn<textarea name="caption" maxLength={600}/></label><div className="form-row"><label>Thẻ, cách nhau dấu phẩy<input name="tags"/></label><label>Tâm trạng<input name="mood"/></label></div>
   <label>Trạng thái<select name="status"><option value="published">Công khai</option><option value="draft">Bản nháp</option></select></label>
   {busy&&<progress aria-label="Tiến độ tải lên" max={100} value={progress}/>}
   <button className="primary" disabled={busy}><UploadCloud size={17}/>{busy?'Đang xử lý…':'Thêm kỷ niệm'}</button>
  </form>
  <div className="upload-management"><h3>Quản lý nội dung</h3><p>Ẩn/lưu bản nháp hoặc lưu trữ; không xóa file trong Drive.</p><div className="upload-management-list">{managed.map(item=><div className="upload-management-row" key={item.id}><span>{item.title} <small>· {item.isPublished?'Công khai':'Bản nháp'}</small></span><div><button type="button" disabled={busy} onClick={()=>void editDetails(item)}>Sửa</button><button type="button" disabled={busy} onClick={()=>void submitEdit(item)}>{item.isPublished?'Ẩn':'Công khai'}</button><button type="button" disabled={busy} onClick={()=>void archive(item)}>Lưu trữ</button></div></div>)}</div></div>
  <button type="button" onClick={async()=>{setBusy(true);setError('');try{await uploads.logout();setAuthorized(false);setManaged([])}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>Đăng xuất</button></>}
  {error&&<p role="alert" className="error">{error}</p>}{success&&<p role="status">{success}</p>}
 </Modal>;
}
