const test = require('node:test');
const assert = require('node:assert/strict');
const dispatch = require('./dispatch-pdf-v2-readiness.cjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
test('dispatch binds evidence to exact main SHA and request, rejects failed/missing run evidence',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pdf-dispatch-'));
  const old={...process.env};t.after(()=>{process.env=old;fs.rmSync(root,{recursive:true,force:true});});
  process.env.RUNNER_TEMP=root;process.env.GITHUB_RUN_ATTEMPT='2';process.env.PDF_SOURCE_SHA='a'.repeat(40);
  const context={repo:{owner:'hoangbao179',repo:'teacher-hub'},ref:'refs/heads/main',runId:123};
  let conclusion='success', artifacts=[{name:'pdf-v2-readiness-123-2',id:10}];
  const github={rest:{actions:{
    createWorkflowDispatch:async p=>assert.deepEqual(p.inputs,{activation_request:'123-2',source_sha:'a'.repeat(40)}),
    listWorkflowRuns:async()=>({data:{workflow_runs:[{display_title:'PDF v2 readiness 123-2',head_sha:'b'.repeat(40),status:'completed',conclusion:'success'},
      {display_title:'PDF v2 readiness 123-2',head_sha:'a'.repeat(40),status:'completed',conclusion,id:5}]}}),
    listWorkflowRunArtifacts:async()=>({data:{artifacts}}),downloadArtifact:async()=>({data:Buffer.from('zip fixture')})}}};
  await dispatch(github,context,{info:()=>{}},async()=>{});
  assert.equal(fs.readFileSync(path.join(root,'pdf-v2-readiness.zip'),'utf8'),'zip fixture');
  conclusion='failure';await assert.rejects(dispatch(github,context,{info:()=>{}},async()=>{}),/READINESS_FAILED/);
  conclusion='success';artifacts=[];await assert.rejects(dispatch(github,context,{info:()=>{}},async()=>{}),/EVIDENCE_MISSING/);
  await assert.rejects(dispatch(github,{...context,ref:'refs/heads/other'},{},async()=>{}),/MAIN_ONLY/);
});
