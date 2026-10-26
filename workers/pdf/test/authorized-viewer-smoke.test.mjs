import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { viewerConfig, runViewerSmoke, main } from './authorized-viewer-smoke.mjs';

const id='1_ArvHdCmU5958R5Le27wjNsRiI5ynzIr';
test('viewer E2E must be explicitly authorized with exact file ID; no implicit network', async()=>{
  assert.throws(()=>viewerConfig({PDF_AUTHORIZED_VIEWER_FILE_ID:id}),/EXPLICIT_APPROVAL/);
  assert.throws(()=>viewerConfig({PDF_AUTHORIZED_VIEWER_E2E_APPROVED:'true',
    PDF_AUTHORIZED_VIEWER_FILE_ID:'https://drive.google.com/file/d/'+id+'/view'}),/FILE_ID/);
  assert.deepEqual(viewerConfig({PDF_AUTHORIZED_VIEWER_E2E_APPROVED:'true',
    PDF_AUTHORIZED_VIEWER_FILE_ID:id}),{fileId:id});
  assert.equal(await main(['--dry-run'],{}),2);
});

test('real-renderer entry point validates PDF, passes bounded caps, deletes output',async()=>{
  let destination, ran=0;
  const result=await runViewerSmoke(id,{
    render:async(fileId,path,cap,signal)=>{
      assert.equal(fileId,id);assert.equal(signal.aborted,false);
      assert.equal(cap.maxBytes,10*1048576);assert.equal(cap.maxPages,40);
      destination=path;ran++;
      await writeFile(path,'%PDF-1.4 test');
    },
    validate:async(path,cap,signal)=>{
      assert.equal(path,destination);assert.equal(cap.deadlineMs,120000);
      assert.equal(signal.aborted,false);
      assert.equal((await readFile(path,'utf8')).startsWith('%PDF-'),true);
      ran++;return{pages:2,bytes:13,sha256:'a'.repeat(64)};
    }
  });
  assert.equal(ran,2);assert.equal(result.status,'AUTHORIZED_VIEWER_RENDER_OK');
  assert.equal(result.outputRetained,false);assert.equal(result.cloudE2E,false);
  await assert.rejects(stat(destination),{code:'ENOENT'});
});

test('enabled capture configuration is not evidence that view-only rendering succeeded',async()=>{
  for(const flag of [undefined,'false','true']){
    const result=await runViewerSmoke(id,{
      env:{PDF_VIEWER_SCREEN_CAPTURE_ENABLED:flag},
      render:async()=>{},
      validate:async()=>({pages:1,bytes:13,sha256:'a'.repeat(64)})
    });
    assert.equal(result.viewerScreenCapture,'NOT_VERIFIED');
    assert.equal(result.printRestrictedViewer,'NOT_SUPPORTED');
    assert.equal(result.cloudE2E,false);
  }
});

test('failed render or invalid PDF cannot pass and temporary PDF is always removed',async()=>{
  let destination;
  await assert.rejects(runViewerSmoke(id,{
    render:async(_,path)=>{destination=path;await writeFile(path,'partial');throw Error('SOURCE_UNAVAILABLE');},
    validate:()=>assert.fail('should not validate')
  }),/SOURCE_UNAVAILABLE/);
  await assert.rejects(stat(destination),{code:'ENOENT'});
  await assert.rejects(runViewerSmoke(id,{
    render:async(_,path)=>writeFile(path,'bad'),
    validate:async()=>({pages:0,bytes:10,sha256:'a'.repeat(64)})
  }),/INVALID_PDF_RESULT/);
});
