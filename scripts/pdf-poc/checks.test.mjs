import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertPages,imageError} from './checks.mjs';
const pages=[{index:1,width:595,height:842,sourceHash:'text'}, {index:2,width:595,height:842,sourceHash:'blank'}, {index:3,width:842,height:595,sourceHash:'landscape'}];
test('preserves blank page and landscape size',()=>assert.doesNotThrow(()=>assertPages(pages,structuredClone(pages))));
test('rejects missing, duplicate, reordered and resized pages',()=>{
 for(const candidate of [pages.slice(0,2),[pages[0],pages[0],pages[2]],[pages[2],pages[1],pages[0]],pages.map(p=>({...p,width:595}))]) assert.throws(()=>assertPages(pages,candidate),/INCOMPLETE/);
});
test('detects wrong content even with correct page numbers',()=>assert.throws(()=>assertPages(pages,pages.map(p=>({...p,sourceHash:'wrong'}))),/identity/));
test('image error includes ink and rejects incompatible buffers',()=>{
 assert.deepEqual(imageError(Uint8Array.of(0,0,0,255),Uint8Array.of(10,10,10,255)),{rmse:10,inkRmse:10});
 assert.throws(()=>imageError(new Uint8Array(4),new Uint8Array(8)),/dimensions/);
});
