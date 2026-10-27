import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateService, RELEASE} from './pdf-v2-readiness.mjs';
import {CLOUD} from './pdf-cloud-stage.mjs';

function fixture(kind) {
  const worker=kind==='worker', name=CLOUD[kind], {revision,digest}=RELEASE[kind];
  const image=CLOUD.registry+'/'+name+'@'+digest;
  const gates=worker?{PDF_CHUNKED_JOBS_ENABLED:'true',PDF_PROCESSING_ENABLED:'true',PDF_WORKER_IAM_READY:'true',PDF_PRINT_FALLBACK_ENABLED:'true',PDF_TEMP_ROOT:'/tmp/pdf-worker'}:
    {PDF_CHUNKED_JOBS_ENABLED:'true',PDF_GATEWAY_ENABLED:'true',PDF_LONG_PRINT_TASKS_ENABLED:'true',PDF_GATEWAY_WORKER_URL:CLOUD.workerURL};
  return {kind,service:{metadata:{name,generation:2,annotations:worker?{}:{'run.googleapis.com/invoker-iam-disabled':'true'}},
    spec:{template:{metadata:{annotations:{'autoscaling.knative.dev/maxScale':'1'}}}},
    status:{observedGeneration:2,conditions:[{type:'Ready',status:'True'}],traffic:[{revisionName:'old',tag:'canary'},{revisionName:revision,percent:100}]}},
    revision:{metadata:{name:revision},status:{imageDigest:image,conditions:[{type:'Ready',status:'True'}]},
      spec:{serviceAccountName:worker?CLOUD.workerSA:CLOUD.gatewaySA,timeoutSeconds:190,containerConcurrency:worker?1:10,
        containers:[{image,resources:{limits:{cpu:'1',memory:worker?'2Gi':'256Mi'}},env:[...Object.entries(gates).map(([name,value])=>({name,value})),
          ...(!worker?[{name:'PDF_GATEWAY_HMAC_KEY',valueFrom:{secretKeyRef:{name:'existing',key:'1'}}}]:[])],
          volumeMounts:[{name:'scratch',mountPath:'/tmp/pdf-worker'}]}],volumes:[{name:'scratch',emptyDir:{medium:'Memory',sizeLimit:'384Mi'}}]}},policy:{bindings:worker?[{role:'roles/run.invoker',members:['serviceAccount:teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com']}]:[]}};
}
const evaluate=f=>evaluateService(f.kind,f.service,f.revision,f.policy);
for(const kind of ['worker','gateway']) {
  test(kind+': accepts pinned live image and ignores zero-traffic tags',()=>assert.deepEqual(evaluate(fixture(kind)),RELEASE[kind]));
  for(const [label,mutate] of [
    ['split traffic',f=>{f.service.status.traffic[0].percent=1;f.service.status.traffic[1].percent=99;}],
    ['wrong live revision',f=>f.service.status.traffic[1].revisionName='old'],
    ['unready',f=>f.revision.status.conditions[0].status='False'],
    ['digest drift',f=>f.revision.status.imageDigest='sha256:'+'f'.repeat(64)],
    ['timeout',f=>f.revision.spec.timeoutSeconds=30],
    ['chunk gate',f=>f.revision.spec.containers[0].env[0].value='false'],
    ['public IAM',f=>f.policy.bindings=[{members:['allUsers']}]],
    ['generation',f=>f.service.status.observedGeneration=1],
    ['identity',f=>f.revision.spec.serviceAccountName='other'],
  ]) test(kind+': fails closed on '+label,()=>{const f=fixture(kind);mutate(f);assert.throws(()=>evaluate(f));});
}
test('worker fails old scratch volume',()=>{const f=fixture('worker');f.revision.spec.volumes[0].emptyDir.sizeLimit='32Mi';assert.throws(()=>evaluate(f),/SCRATCH_DRIFT/);});
test('gateway fails wrong Cloud Tasks target',()=>{const f=fixture('gateway');f.revision.spec.containers[0].env.find(e=>e.name==='PDF_GATEWAY_WORKER_URL').value='https://other';assert.throws(()=>evaluate(f),/GATEWAY_DRIFT/);});
