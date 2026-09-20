import {describe,it,expect} from 'vitest';
import {collection,layout,randomSong} from '../src/lib';
import {mockMedia} from '../src/data';
import {media,uploads} from '../src/services';
import worker from '../server/worker';
import {publicMedia} from '../server/repository';

describe('library and basket',()=>{
  it('searches accent insensitive and sorts by popularity',()=>{
    expect(collection(mockMedia,'quai nhon')).toHaveLength(18);
    expect(collection(mockMedia,'not found')).toEqual([]);
    expect(collection(mockMedia,'','popular')[0].favoriteCount).toBe(206);
  });
  it('shuffles layouts without modifying records',()=>{
    const before=JSON.stringify(mockMedia);
    const ids=mockMedia.map(x=>x.id);
    expect(layout(ids,true)).not.toEqual(layout(ids));
    expect(JSON.stringify(mockMedia)).toBe(before);
  });
  it('selects only playable song',()=>{
    expect(randomSong(mockMedia)).toBeUndefined();
    const song={...mockMedia[0],audioUrl:'/test.wav'};
    expect(randomSong([...mockMedia,song])?.id).toBe(song.id);
  });
  it('uses stable IDs',async()=>{expect((await media.get('memory-2'))?.title).toBe('Nắng qua hiên nhà')});
});
describe('owner isolation',()=>{
  it('demo sign-in is labeled mock and can logout',async()=>{
    expect((await uploads.login())?.demo).toBe(true);
    expect((await uploads.session()).authorized).toBe(true);
    await uploads.logout();
    expect((await uploads.session()).authorized).toBe(false);
  });
  it('rejects unauthorized admin reads and cross-origin writes',async()=>{
    const get=await worker.fetch(new Request('https://hani.quainhon.com/api/admin/media'),{});
    expect(get.status).toBe(401);
    const post=await worker.fetch(new Request('https://hani.quainhon.com/api/admin/upload/song',{method:'POST',headers:{Origin:'https://evil.example'}}),{});
    expect(post.status).toBe(403);
  });
  it('fails closed without database',async()=>{
    expect((await worker.fetch(new Request('https://hani.quainhon.com/api/media'),{})).status).toBe(503);
  });
  it('does not leak private Drive IDs',()=>{
    const value=publicMedia({id:'safe',drive_file_id:'private',cover_drive_file_id:null,type:'song',title:'Title',artist:null,caption:'',tags:'[]',mood:'[]',published_at:'2026-01-01',is_published:1,favorite_count:2,play_count:0,duration_sec:null,deleted_at:null});
    expect(JSON.stringify(value)).not.toContain('private');
    expect(value.imageUrl).toBe('/api/media/safe/cover');
  });
});
