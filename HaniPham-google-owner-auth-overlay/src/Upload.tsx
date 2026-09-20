import { useEffect, useState } from 'react';
import { LockKeyhole, UploadCloud } from 'lucide-react';
import { Modal } from './Modal';
import { isDemo, uploads } from './services';
import type { BasketItem } from './types';

export function Upload({onClose, onAdded}:{onClose:()=>void;onAdded:()=>void}) {
  const [authorized,setAuthorized] = useState(false);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [progress,setProgress] = useState(0);
  const [success,setSuccess] = useState('');
  const [kind,setKind] = useState<'song'|'photo'>('song');
  const [library,setLibrary] = useState<BasketItem[]>([]);
  const [editId,setEditId] = useState('');
  const [editTitle,setEditTitle] = useState('');
  const [editCaption,setEditCaption] = useState('');
  useEffect(()=>{
    uploads.session().then(s=>setAuthorized(s.authorized)).catch(()=>{});
    const params=new URLSearchParams(location.search);
    const error=params.get('auth_error');
    if(error)setError(error);
    if(params.has('upload')) history.replaceState(null,'',location.pathname+location.hash);
  },[]);
  async function reload(){setLibrary(await uploads.list());onAdded()}
  async function signIn(){setBusy(true);setError('');try{const s=await uploads.login();if(s?.authorized)setAuthorized(true)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  async function performEdit(action:()=>Promise<unknown>,message:string){setBusy(true);setError('');try{await action();await reload();setSuccess(message);setEditId('')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  return <Modal title={authorized?'Gửi một kỷ niệm':'Đăng nhập để quản lý'} onClose={onClose}>
    <div className="upload-symbol"><LockKeyhole/></div>
    {isDemo&&<p className="notice">Chế độ DEMO · Đăng nhập chỉ là mô phỏng. Tệp chỉ tồn tại trong phiên này, không gửi lên Google Drive.</p>}
    {!authorized?<div>
      <p>Chỉ tài khoản Google được chủ website cấp quyền mới có thể tải lên và quản lý nội dung.</p>
      <div className="actions"><button type="button" onClick={onClose}>Hủy</button><button type="button" className="primary" disabled={busy} onClick={signIn}>{isDemo?'Thử giao diện quản lý (DEMO)':'Đăng nhập bằng Google'}</button></div>
    </div>:<>
      <form onSubmit={async e=>{
        e.preventDefault();const form=e.currentTarget;const d=new FormData(form);setBusy(true);setError('');setSuccess('');
        try {
          await uploads.upload({type:kind,title:String(d.get('title')),artist:String(d.get('artist')||'Hani Pham'),caption:String(d.get('caption')),tags:String(d.get('tags')).split(',').map(s=>s.trim()).filter(Boolean),mood:String(d.get('mood')).split(',').map(s=>s.trim()).filter(Boolean),isPublished:d.get('status')==='published',image:d.get('image') as File,audio:kind==='song'?d.get('audio') as File:undefined},setProgress);
          setSuccess(d.get('status')==='published'?'Đã thêm vào rổ kỷ niệm.':'Đã lưu bản nháp.');form.reset();await reload();
        }catch(e){setError((e as Error).message)}finally{setBusy(false)}
      }}>
        <label>Loại kỷ niệm<select value={kind} onChange={e=>setKind(e.target.value as 'song'|'photo')}><option value="song">Bài hát</option><option value="photo">Ảnh</option></select></label>
        <label>Tên / tiêu đề<input name="title" required maxLength={150}/></label>
        {kind==='song'&&<><label>Nghệ sĩ<input name="artist" defaultValue="Hani Pham"/></label><label>Âm thanh · tối đa 24 MB<input name="audio" type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4" required/></label></>}
        <label>Ảnh {kind==='song'?'bìa':''} · tối đa 8 MB<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required/></label>
        <label>Lời nhắn<textarea name="caption" maxLength={600}/></label>
        <div className="form-row"><label>Thẻ, cách nhau dấu phẩy<input name="tags"/></label><label>Tâm trạng<input name="mood"/></label></div>
        <label>Trạng thái<select name="status"><option value="published">Công khai</option><option value="draft">Bản nháp</option></select></label>
        {busy&&<progress aria-label="Tiến độ tải lên" max={100} value={progress}/>}
        <button className="primary" disabled={busy}><UploadCloud size={17}/>{busy?'Đang thêm…':'Thêm kỷ niệm'}</button>
      </form>
      <details className="owner-manager" onToggle={e=>{if(e.currentTarget.open)uploads.list().then(setLibrary).catch(err=>setError(err.message))}}>
        <summary>Quản lý bài hát, hình ảnh và bản nháp</summary>
        {library.map(item=><div key={item.id} className="owner-row"><strong>{item.title}</strong> · {item.isPublished?'Công khai':'Bản nháp'}
          <div className="actions">
            <button type="button" disabled={busy} onClick={()=>performEdit(()=>uploads.edit(item.id,{isPublished:!item.isPublished}),item.isPublished?'Đã ẩn khỏi trang công khai.':'Đã công khai.')}>{item.isPublished?'Ẩn':'Công khai'}</button>
            <button type="button" disabled={busy} onClick={()=>{setEditId(item.id);setEditTitle(item.title);setEditCaption(item.caption)}}>Sửa</button>
            <button type="button" disabled={busy} onClick={()=>{if(window.confirm('Ẩn kỷ niệm khỏi rổ? Tệp trong Google Drive vẫn được giữ nguyên.'))void performEdit(()=>uploads.archive(item.id),'Đã ẩn kỷ niệm.')}}>Lưu trữ</button>
          </div>
          {editId===item.id&&<form onSubmit={e=>{e.preventDefault();void performEdit(()=>uploads.edit(item.id,{title:editTitle,caption:editCaption}),'Đã cập nhật.')}}><label>Tên<input value={editTitle} maxLength={150} required onChange={e=>setEditTitle(e.target.value)}/></label><label>Lời nhắn<textarea value={editCaption} maxLength={600} onChange={e=>setEditCaption(e.target.value)}/></label><button type="submit" disabled={busy}>Lưu thay đổi</button></form>}
        </div>)}
        {!library.length&&<p>Chưa có nội dung để quản lý.</p>}
      </details>
      <button type="button" onClick={async()=>{await uploads.logout();setAuthorized(false);setLibrary([])}}>Đăng xuất</button>
    </>}
    {error&&<p role="alert" className="error">{error}</p>}
    {success&&<p role="status">{success}</p>}
  </Modal>
}
