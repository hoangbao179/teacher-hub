import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPageLimits} from './browser-limits.mjs';
const fixture=Array.from({length:5},(_,i)=>({width:i===4?842:595,height:i===4?595:842}));
test('accepts full-size owned fixture without dropping blank or landscape page',()=>assert.doesNotThrow(()=>assertPageLimits(fixture)));
test('rejects missing pages and excessive raster allocations before rendering',()=>{
  for(const candidate of [fixture.slice(1),fixture.map(p=>({...p,width:10000})),fixture.map(p=>({...p,height:NaN})),fixture.map(p=>({...p,width:0}))])assert.throws(()=>assertPageLimits(candidate),/INCOMPLETE/);
});
