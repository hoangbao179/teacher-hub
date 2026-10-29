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
  let previous=base;
  for (const path of ['client/style.css','client/logo.svg','server/src/api.ts','.github/workflows/ci.yml',
    'scripts/pdf-worker-changes.test.cjs','scripts/pdf-worker-auto-release.mjs']) {
    mkdirSync(join(dir,path,'..'),{recursive:true}); writeFileSync(join(dir,path),'test');
    git(['add','.']); git(['commit','--quiet','-m','non-image change']);
    const head=git(['rev-parse','HEAD']);
    assert.equal(detect.changed(previous,head,run),false,path);
    previous=head;
  }
  assert.equal(detect.changed(base,git(['rev-parse','HEAD']),run),false);
  for (const path of [...detect.paths.map(p=>p.endsWith('/')?p+'fixture.ts':p),
    'workers/pdf/src/processor.ts','workers/pdf/Dockerfile','workers/pdf/package-lock.json',
    'shared/src/pdf-pipeline.ts','shared/tsconfig.esm.json']) {
    mkdirSync(join(dir,path,'..'),{recursive:true}); writeFileSync(join(dir,path),'test');
    git(['add','.']); git(['commit','--quiet','-m','worker input']);
    const head=git(['rev-parse','HEAD']);
    assert.equal(detect.changed(previous,head,run),true,path);
    previous=head;
  }
  assert.equal(detect.changed(base,previous,run),true,'multiple commits (same tree comparison as squash)');
  assert.equal(detect.changed(OLD,base,run),true,'unavailable history');
});

test('initial/missing base, git failure or signal builds conservatively',()=>{
  for(const base of [undefined,'','0'.repeat(40),'invalid']) assert.equal(detect.changed(base,SHA,()=>({status:128})),true);
  for(const status of [1,128,null]) assert.equal(detect.changed(OLD,SHA,()=>({status})),true);
  assert.equal(detect.changed(OLD,SHA,()=>({status:0})),false);
});

const current={id:10,run_number:10,run_attempt:1,head_sha:SHA,workflow_id:1,path:'.github/workflows/ci.yml'};
function entry(n,extra={}) {
  return {id:n,run_number:n,head_sha:OLD,event:'push',head_branch:'main',workflow_id:1,
    status:'completed',conclusion:'success',head_repository:{full_name:'hoangbao179/teacher-hub'},...extra};
}
function staged(sha=OLD,extra={}) {
  return {name:detect.stageJobName,head_sha:sha,status:'completed',conclusion:'success',
    steps:[...detect.stageSteps,detect.stageCompletionSteps[0]].map(name=>({name,status:'completed',conclusion:'success'})),...extra};
}
function client({pages=[[]],jobs={},failure,currentRun=current}={}) {
  const calls=[];
  const actions={
    getWorkflowRun:async()=>{if(failure==='current')throw Error('private API diagnostic');return {data:currentRun};},
    listWorkflowRuns:()=>{},listJobsForWorkflowRun:()=>{},
  };
  const paginate=async(endpoint,args)=>{
    assert.equal(endpoint,actions.listJobsForWorkflowRun); calls.push(args);
    assert.equal(args.filter,'all','keep successful stage evidence from earlier attempts');
    if(failure==='jobs')throw Error('private API diagnostic');
    return jobs[args.run_id]??[];
  };
  paginate.iterator=async function*(endpoint,args) {
    assert.equal(endpoint,actions.listWorkflowRuns); assert.equal(args.status,'completed');
    assert.equal(args.branch,'main'); assert.equal(args.workflow_id,'ci.yml');
    if(failure==='runs')throw Error('private API diagnostic');
    for(const page of pages)yield {data:page}; // Octokit normalizes to arrays.
  };
  return {rest:{actions},paginate,calls};
}
async function exercise(options={},ctx=context,status=0) {
  const api=client(options),outputs=[],logs=[],diffs=[];
  await detect(api,ctx,{setOutput:(k,v)=>outputs.push([k,v]),info:x=>logs.push(x)},(cmd,args)=>{
    assert.equal(cmd,'git');diffs.push(args);return {status};
  });
  return {api,outputs,logs,diffs};
}

test('CI PASS with Worker skipped while flag OFF does not consume unstaged Worker A before CSS B',async()=>{
  const A='c'.repeat(40);
  const r=await exercise({pages:[[entry(9,{head_sha:A})]],jobs:{9:[staged(A,{conclusion:'skipped'})]}});
  assert.deepEqual(r.outputs,[['changed','true']]);assert.deepEqual(r.diffs,[]);
  assert(r.logs.some(l=>l.includes('No verified Worker stage')));
  const withEarlierStage=await exercise({pages:[[entry(9,{head_sha:A}),entry(8)]],
    jobs:{9:[],8:[staged()]}},context,1);
  assert.equal(withEarlierStage.diffs[0][2],OLD);
  assert.deepEqual(withEarlierStage.outputs,[['changed','true']]);
});

for(const conclusion of ['failure','cancelled','skipped']) test('Worker stage '+conclusion+' cannot advance baseline',async()=>{
  const A='c'.repeat(40);
  const r=await exercise({pages:[[entry(9,{head_sha:A,conclusion}),entry(8)]],
    jobs:{9:[staged(A,{conclusion})],8:[staged()]}},context,1);
  assert.equal(r.diffs[0][2],OLD);
  assert.deepEqual(r.outputs,[['changed','true']]);
});

test('auto-promoted release with all required evidence advances stage baseline',async()=>{
  const steps=[...detect.stageSteps,detect.stageCompletionSteps[1]]
    .map(name=>({name,status:'completed',conclusion:'success'}));
  const r=await exercise({pages:[[entry(9)]],jobs:{9:[staged(OLD,{steps})]}});
  assert.deepEqual(r.outputs,[['changed','false']]);
  const partial=steps.filter(s=>s.name!==detect.stageCompletionSteps[1]);
  const noFinal=await exercise({pages:[[entry(9)]],jobs:{9:[staged(OLD,{steps:partial})]}});
  assert.deepEqual(noFinal.outputs,[['changed','true']]);
});

test('same inputs after verified stage skip build, even across successful non-stage CIs',async()=>{
  const r=await exercise({pages:[[entry(9),entry(8)]],jobs:{9:[],8:[staged()]}});
  assert.equal(r.diffs[0][2],OLD);assert.deepEqual(r.outputs,[['changed','false']]);
  assert(r.logs.some(l=>l.includes('WORKER_STAGE_SUCCESS baseline: run 8')));
  assert(r.logs.some(l=>l.includes('Production promotion is not inferred')));
});

test('later CI failure after a genuinely successful Worker stage does not erase stage evidence',async()=>{
  const r=await exercise({pages:[[entry(9,{conclusion:'failure'})]],jobs:{9:[staged()]}});
  assert.deepEqual(r.outputs,[['changed','false']]);
});

test('successful earlier attempt of same source avoids a useless rebuild on rerun',async()=>{
  const r=await exercise({currentRun:{...current,run_attempt:2},jobs:{10:[staged(SHA)]}});
  assert.equal(r.diffs[0][2],SHA);assert.equal(r.api.calls[0].filter,'all');
  assert.deepEqual(r.outputs,[['changed','false']]);
});

test('history paginates past skipped stages and stops after verified evidence',async()=>{
  const r=await exercise({pages:[[entry(9)],[entry(8)],[entry(7)]],jobs:{8:[staged()]}});
  assert.deepEqual(r.api.calls.map(c=>c.run_id),[9,8]);
  assert.deepEqual(r.outputs,[['changed','false']]);
});

test('workflow path with ref suffix still identifies the same CI workflow',async()=>{
  const r=await exercise({currentRun:{...current,path:'.github/workflows/ci.yml@refs/heads/main'},
    pages:[[entry(9)]],jobs:{9:[staged()]}});
  assert.deepEqual(r.outputs,[['changed','false']]);
});

test('PR, fork, non-main, other workflow, future/current run and malformed SHA never supply evidence',async()=>{
  const rows=[entry(11),entry(10),entry(9,{event:'pull_request'}),
    entry(8,{head_repository:{full_name:'fork/teacher-hub'}}),entry(7,{head_branch:'feature'}),
    entry(6,{workflow_id:2}),entry(5,{head_sha:'invalid'}),entry(4)];
  const r=await exercise({pages:[rows],jobs:{4:[staged()]}});
  assert.deepEqual(r.api.calls.map(c=>c.run_id),[4]);
  assert.deepEqual(r.outputs,[['changed','false']]);
});

test('job success without source binding and all stage gates is insufficient',async()=>{
  for(const job of [staged(SHA),staged(OLD,{name:'quality'}),staged(OLD,{steps:[]}),
    staged(OLD,{status:'in_progress'}),
    ...[...detect.stageSteps,detect.stageCompletionSteps[0]].map(name=>staged(OLD,{steps:[...detect.stageSteps,detect.stageCompletionSteps[0]].map(n=>({name:n,status:'completed',conclusion:n===name?'skipped':'success'}))}))]) {
    const r=await exercise({pages:[[entry(9)]],jobs:{9:[job]}});
    assert.deepEqual(r.outputs,[['changed','true']]);assert.deepEqual(r.diffs,[]);
  }
});

test('API errors, no stage history or missing Git history build conservatively with safe diagnostics',async()=>{
  for(const options of [{},{failure:'current'},{failure:'runs'},{failure:'jobs',pages:[[entry(9)]]},
    {currentRun:{...current,path:'other.yml'}},{currentRun:{...current,workflow_id:undefined}},
    {currentRun:{...current,head_sha:OLD}}]) {
    const r=await exercise(options);
    assert.deepEqual(r.outputs,[['changed','true']]);assert.deepEqual(r.diffs,[]);
    assert(!r.logs.join().includes('private API diagnostic'));
  }
  const r=await exercise({pages:[[entry(9)]],jobs:{9:[staged()]}},context,128);
  assert.deepEqual(r.outputs,[['changed','true']]);
});

test('manual force=false is CI only; explicit force=true requests release without trusting history',async()=>{
  for(const force of [undefined,false,'false',true,'true']) {
    const outputs=[];
    await detect({}, {...context,eventName:'workflow_dispatch',payload:{inputs:{force_worker_release:force}}},
      {setOutput:(k,v)=>outputs.push([k,v])});
    assert.deepEqual(outputs,[['changed',String(force===true||force==='true')]]);
  }
  await assert.rejects(detect({}, {...context,eventName:'pull_request'},{}),/trusted main/);
  await assert.rejects(detect({}, {...context,ref:'refs/tags/main'},{}),/trusted main/);
});
