import test from "node:test";
import assert from "node:assert/strict";
import {evaluate,READ_COMMANDS,TARGET,snapshotWithGcloud,gcloudInvocation} from "./pdf-cloud-readiness.mjs";
const image="asia-southeast1-docker.pkg.dev/teacher-hub-pdf/teacher-pdf/worker@sha256:"+"a".repeat(64);
function fixture() {
 return {
   service:{metadata:{name:TARGET.service,generation:2,annotations:{"run.googleapis.com/invoker-iam-disabled":"false"}},
     status:{observedGeneration:2,latestReadyRevisionName:"worker-00002",traffic:[{percent:100,revisionName:"worker-00002"}]},
     spec:{template:{metadata:{annotations:{"autoscaling.knative.dev/maxScale":"3","autoscaling.knative.dev/minScale":"0"}},spec:{serviceAccountName:TARGET.runtimeSA,containerConcurrency:1,timeoutSeconds:30,
       containers:[{image,resources:{limits:{cpu:"1",memory:"2Gi"}},env:[{name:"PDF_PROCESSING_ENABLED",value:"true"},{name:"PDF_WORKER_IAM_READY",value:"true"},{name:"PDF_TEMP_ROOT",value:"/tmp/pdf-worker"}],
         volumeMounts:[{name:"pdf-temp",mountPath:"/tmp/pdf-worker"}]}],
       volumes:[{name:"pdf-temp",emptyDir:{medium:"Memory",sizeLimit:"32Mi"}}]}}}},
   serviceIam:{bindings:[{role:"roles/run.invoker",members:["serviceAccount:"+TARGET.invokerSA]}]},
   queue:{name:TARGET.queue,state:"RUNNING",rateLimits:{maxConcurrentDispatches:1,maxDispatchesPerSecond:1},
     retryConfig:{maxAttempts:5,maxRetryDuration:"3600s",minBackoff:"10s",maxBackoff:"300s"}},
   bucket:{name:TARGET.bucket,iamConfiguration:{publicAccessPrevention:"enforced"}},
   bucketIam:{bindings:[]},
 };
}
test("read-only inventory is never permission to activate",()=>{
 const result=evaluate(fixture());
 assert.equal(result.resourcesVerified,true);
 assert.equal(result.activationAllowed,false);
 assert.deepEqual(result.checks.filter(x=>x.result!=="PASS").map(x=>x.id),["producer-identity","recovery-and-cloud-e2e"]);
});
test("missing evidence fails closed",()=>{
 const result=evaluate({});
 assert.equal(result.resourcesVerified,false);
 assert.equal(result.activationAllowed,false);
 assert(result.checks.some(x=>x.result==="BLOCKED"));
});
test("public invoker and service IAM bypass are forbidden",()=>{
 const x=fixture();x.serviceIam.bindings.push({role:"roles/run.invoker",members:["allUsers"]});
 x.service.metadata.annotations["run.googleapis.com/invoker-iam-disabled"]="true";
 const r=evaluate(x);
 assert.deepEqual(r.checks.filter(x=>x.result==="FAIL").map(x=>x.id),["run-iam-check","run-iam-policy"]);
});
test("unbounded temp, mutable image, queue retry drift are rejected",()=>{
 const x=fixture();
 x.service.spec.template.spec.volumes[0].emptyDir.sizeLimit="256Mi";
 x.service.spec.template.spec.containers[0].image="example:latest";
 x.queue.retryConfig.maxAttempts=10;
 const fails=evaluate(x).checks.filter(c=>c.result==="FAIL").map(c=>c.id);
 assert(fails.includes("run-bounded-temp"));
 assert(fails.includes("run-immutable-image"));
 assert(fails.includes("queue-policy"));
});
test("gcloud collector calls only fixed read-only commands and suppresses failures",()=>{
 const calls=[];
 const evidence=snapshotWithGcloud((_cmd,args)=>{
   calls.push(args.join(" "));
   if(args[0]==="storage")throw Error("secret-bearing error must not appear");
   return JSON.stringify({name:"synthetic"});
 }, "linux"); // Explicit Linux mode; Windows dispatch has its own test.
 assert.deepEqual(calls,Object.values(READ_COMMANDS).map(x=>x.join(" ")));
 assert.equal(evidence.bucket,null);
 assert.equal(evidence.bucketIam,null);
 assert.deepEqual(evidence.service,{name:"synthetic"});
});

test("Windows cmd shim is used with only allowlisted gcloud arguments",()=>{
  const calls=[];
  snapshotWithGcloud((command,args)=>{calls.push({command,args});return "{}";},"win32");
  assert.equal(calls.length,Object.keys(READ_COMMANDS).length);
  assert(calls.every(c=>c.command==="cmd.exe" && c.args[0]==="/d" && c.args[1]==="/s" && c.args[2]==="/c"));
  assert(calls.every(c=>c.args[3].startsWith("gcloud ")));
  assert.throws(()=>gcloudInvocation(["foo & whoami"],"win32"),/UNSAFE_GCLOUD_ARGUMENT/);
  assert.deepEqual(gcloudInvocation(["run","services","describe"],"linux"),{command:"gcloud",args:["run","services","describe"]});
});

test("traffic/resource/IAM drift cannot verify cloud resources",()=>{
 const a=fixture();a.service.status.traffic=[{percent:100,revisionName:"worker-old"}];
 assert.equal(evaluate(a).resourcesVerified,false);
 assert(evaluate(a).checks.some(c=>c.id==="run-live-traffic"&&c.result==="FAIL"));
 const b=fixture();b.service.spec.template.spec.containers[0].resources.limits.memory="256Mi";
 assert(evaluate(b).checks.some(c=>c.id==="run-resource-budget"&&c.result==="FAIL"));
 const c=fixture();c.serviceIam.bindings[0].members.push("serviceAccount:another@example.iam.gserviceaccount.com");
 assert(evaluate(c).checks.some(c=>c.id==="run-iam-policy"&&c.result==="FAIL"));
 const d=fixture();delete d.service.status;
 assert(evaluate(d).checks.some(c=>c.id==="run-live-traffic"&&c.result==="FAIL"));
});
