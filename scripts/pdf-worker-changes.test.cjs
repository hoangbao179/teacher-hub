const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const detect = require('./pdf-worker-changes.cjs');
const SHA = 'a'.repeat(40), OLD = 'b'.repeat(40);
const context = {repo:{owner:'hoangbao179',repo:'teacher-hub'},ref:'refs/heads/main',eventName:'push',sha:SHA,runId:10,payload:{}};

test('real git ranges include multiple/squashed commits and every Docker input; omit frontend/API-only files', t => {
  const dir = mkdtempSync(join(tmpdir(),'pdf-worker-diff-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const git = args => execFileSync('git',args,{cwd:dir,encoding:'utf8'}).trim();
  git(['init','--quiet']); git(['config','user.email','synthetic@example.invalid']); git(['config','user.name','Synthetic test']);
  git(['commit','--quiet','--allow-empty','-m','base']); const base=git(['rev-parse','HEAD']);
  const run = (cmd,args)=>spawnSync(cmd,args,{cwd:dir});
  for (const path of ['client/style.css','client/logo.svg','server/src/api.ts']) {
    mkdirSync(join(dir,path,'..'),{recursive:true}); writeFileSync(join(dir,path),'test');
  }
  git(['add','.']); git(['commit','--quiet','-m','apps only']);
  assert.equal(detect.changed(base,git(['rev-parse','HEAD']),run),false);
  for (const path of detect.paths.map(p=>p.endsWith('/')?p+'fixture.ts':p)) {
    mkdirSync(join(dir,path,'..'),{recursive:true}); writeFileSync(join(dir,path),'test');
    git(['add','.']); git(['commit','--quiet','-m','worker input']);
    assert.equal(detect.changed(base,git(['rev-parse','HEAD']),run),true,path);
    git(['reset','--quiet','--soft',base]);
    // Keep prior app commits only in the initial multi-commit scenario. The next
    // iteration starts clean in this isolated synthetic repository.
    git(['reset','--quiet','--hard',base]);
  }
  assert.equal(detect.changed(OLD,base,run),true,'unavailable history');
});

test('initial/missing base, git failure or signal builds conservatively',()=>{
  for(const base of [undefined,'','0'.repeat(40),'invalid']) assert.equal(detect.changed(base,SHA,()=>({status:128})),true);
  for(const status of [1,128,null]) assert.equal(detect.changed(OLD,SHA,()=>({status})),true);
  assert.equal(detect.changed(OLD,SHA,()=>({status:0})),false);
});

function client(runs,fail=false) {
  return {rest:{actions:{getWorkflowRun:async()=>({data:{run_number:10}}),listWorkflowRuns:()=>{}}},
    paginate:async()=>{if(fail)throw Error('API unavailable'); return runs;}};
}
test('baseline is last successful trusted delivery, excluding PR and future/current reruns',async()=>{
  const calls=[],outputs=[];
  const rows=[
    {event:'pull_request',run_number:9,head_sha:SHA},
    {event:'push',run_number:11,head_sha:SHA},
    {event:'workflow_dispatch',run_number:8,head_sha:OLD,head_repository:{full_name:'hoangbao179/teacher-hub'}},
    {event:'push',run_number:7,head_sha:SHA,head_repository:{full_name:'hoangbao179/teacher-hub'}},
  ];
  await detect(client(rows),context,{setOutput:(...args)=>outputs.push(args)},(cmd,args)=>{calls.push(args);return {status:0};});
  assert.equal(calls[0][2],OLD); assert.deepEqual(outputs,[['changed','false']]);
});
test('API failure/no previous delivery and explicit bootstrap never skip',async()=>{
  for(const c of [client([]),client([],true)]) {
    await detect(c,context,{setOutput:(k,v)=>assert.equal(v,'true')},()=>{throw Error('should not diff');});
  }
  await detect({}, {...context,eventName:'workflow_dispatch',payload:{inputs:{force_worker_release:'true'}}},
    {setOutput:(k,v)=>assert.equal(v,'true')});
  await assert.rejects(detect({}, {...context,eventName:'pull_request'},{}),/trusted main/);
  await assert.rejects(detect({}, {...context,ref:'refs/tags/main'},{}),/trusted main/);
});
