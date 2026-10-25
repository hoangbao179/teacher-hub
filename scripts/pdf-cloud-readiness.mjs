#!/usr/bin/env node
/**
 * Read-only PDF Cloud activation inventory. No IAM mutation, deployment, token
 * exchange, job submission, producer activation or file download occurs here.
 * Run on an authorized OPERATOR workstation, never in the VPS/API container.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const TARGET = Object.freeze({
  project: "teacher-hub-pdf", region: "asia-southeast1", service: "teacher-pdf-worker",
  runtimeSA: "teacher-pdf-worker@teacher-hub-pdf.iam.gserviceaccount.com",
  invokerSA: "teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com",
  queue: "projects/teacher-hub-pdf/locations/asia-southeast1/queues/teacher-pdf-queue",
  bucket: "teacher-hub-pdf-results-2026",
});

export const READ_COMMANDS = Object.freeze({
  service: ["run", "services", "describe", TARGET.service, "--project", TARGET.project, "--region", TARGET.region, "--format=json"],
  serviceIam: ["run", "services", "get-iam-policy", TARGET.service, "--project", TARGET.project, "--region", TARGET.region, "--format=json"],
  queue: ["tasks", "queues", "describe", "teacher-pdf-queue", "--project", TARGET.project, "--location", TARGET.region, "--format=json"],
  bucket: ["storage", "buckets", "describe", "gs://" + TARGET.bucket, "--project", TARGET.project, "--raw", "--format=json"],
  bucketIam: ["storage", "buckets", "get-iam-policy", "gs://" + TARGET.bucket, "--project", TARGET.project, "--format=json"],
});

const yes = value => value === true || value === "true";
const members = policy => (policy?.bindings ?? []).flatMap(binding => binding.members ?? []);
const publicMembers = policy => members(policy).some(member => member === "allUsers" || member === "allAuthenticatedUsers");
const serviceSpec = service => {
  const template = service?.spec?.template ?? service?.template ?? {};
  const spec = template.spec ?? template;
  return { spec, container: spec.containers?.[0] ?? {} };
};
const env = (container, name) => container?.env?.find(v => v.name === name)?.value;
const push = (checks, id, passed, message) => checks.push({
  id, result: passed ? "PASS" : "FAIL", message,
});
const cannotRead = (checks, id) => checks.push({
  id, result: "BLOCKED", message: "Không đọc được bằng quyền hiện tại; chưa xác minh.",
});

/**
 * Evaluates evidence without inferring runtime producer identity or recovery.
 * Evidence object is never echoed, to avoid disclosing IAM policies or secrets.
 */
export function evaluate(snapshot, source = "offline-snapshot") {
  const checks = [];
  const svc = snapshot?.service;
  const revision = snapshot?.revision;
  const iam = snapshot?.serviceIam;
  const queue = snapshot?.queue;
  const bucket = snapshot?.bucket;
  const bucketIam = snapshot?.bucketIam;

  if (!svc) cannotRead(checks, "run-service");
  else {
    const {spec, container} = serviceSpec(svc);
    const annotations = {...svc.metadata?.annotations,...svc.annotations};
    push(checks,"run-service",svc.metadata?.name === TARGET.service || svc.name?.endsWith("/services/"+TARGET.service),
      "Cloud Run phải đúng service teacher-pdf-worker.");
    push(checks,"run-iam-check",!yes(annotations["run.googleapis.com/invoker-iam-disabled"]) && !yes(svc.invokerIamDisabled),
      "Cloud Run phải bật kiểm tra IAM invoker.");
    // Never treat the desired service template as proof of the running
    // revision. Cloud Run can observe a failed rollout while continuing to
    // serve traffic from an older healthy revision.
    const live = revision?.spec ?? {};
    const liveContainer = live.containers?.[0] ?? {};
    const desiredContainer = container;
    const status = svc.status ?? {};
    const liveStatus = revision?.status ?? {};
    const readyCondition = value => value?.conditions?.some(c => c.type === "Ready" && c.status === "True") === true;
    const traffic = status.traffic;
    const activeName = status.latestReadyRevisionName;
    const actualDigest=liveStatus.imageDigest;
    const expectedDigest=/@(?<digest>sha256:[a-f0-9]{64})$/.exec(liveContainer.image ?? "")?.groups?.digest;
    const digestVerified=typeof actualDigest === "string" && !!expectedDigest &&
      (actualDigest === expectedDigest || actualDigest.endsWith("@" + expectedDigest));
    const ready = typeof activeName === "string" && /^teacher-pdf-worker-[0-9]{5}-[a-z0-9]+$/.test(activeName) &&
      status.latestCreatedRevisionName === activeName &&
      readyCondition(status) && readyCondition(liveStatus) && digestVerified &&
      revision?.metadata?.name === activeName &&
      (!liveStatus.serviceName || liveStatus.serviceName === TARGET.service) &&
      Array.isArray(traffic) && traffic.length === 1 &&
      Number(traffic[0]?.percent) === 100 && traffic[0]?.revisionName === activeName &&
      typeof svc.metadata?.generation === "number" &&
      status.observedGeneration === svc.metadata.generation;
    push(checks,"run-live-traffic",ready,
      "Latest created revision must be Ready=True, resolve to the expected digest and receive 100% traffic.");
    const desired = spec;
    const same = (a,b) => a !== undefined && b !== undefined && JSON.stringify(a) === JSON.stringify(b);
    const selectedEnv = ["PDF_PROCESSING_ENABLED","PDF_WORKER_IAM_READY","PDF_TEMP_ROOT"];
    const mount = value => value?.volumeMounts?.find(v => v.mountPath === "/tmp/pdf-worker");
    const temp = (specification, c) => specification?.volumes?.find(v => v.name === mount(c)?.name);
    const revisionTemplateMatches =
      same(live.serviceAccountName,desired.serviceAccountName) &&
      same(live.containerConcurrency,desired.containerConcurrency) &&
      same(live.timeoutSeconds,desired.timeoutSeconds) &&
      same(liveContainer.image,desiredContainer.image) &&
      same(liveContainer.resources?.limits,desiredContainer.resources?.limits) &&
      selectedEnv.every(name => same(env(liveContainer,name),env(desiredContainer,name))) &&
      same(mount(liveContainer),mount(desiredContainer)) &&
      same(temp(live,liveContainer),temp(desired,desiredContainer));
    push(checks,"run-revision-template-match",revisionTemplateMatches,
      "Live revision identity, image digest, resources, gates and memory mount must match desired service template.");
    push(checks,"run-runtime-sa",live.serviceAccountName === TARGET.runtimeSA,
      "Running revision must use the dedicated Worker service account.");
    push(checks,"run-immutable-image",/@sha256:[a-f0-9]{64}$/.test(liveContainer.image ?? ""),
      "Running revision must use an immutable image digest.");
    push(checks,"run-capacity",Number(live.containerConcurrency) === 1,
      "Running revision can receive only one job at a time.");
    const resources=liveContainer.resources?.limits ?? {};
    const template=svc.spec?.template ?? {};
    const autoscale={...svc.metadata?.annotations,...template.metadata?.annotations};
    push(checks,"run-resource-budget",resources.cpu==="1" && resources.memory==="2Gi" &&
      Number(live.timeoutSeconds)===30 &&
      Number(autoscale["autoscaling.knative.dev/maxScale"])>=1 &&
      Number(autoscale["autoscaling.knative.dev/maxScale"])<=3 &&
      (autoscale["autoscaling.knative.dev/minScale"]??"0")==="0",
      "Verify CPU 1, RAM 2Gi, timeout 30s on running revision and desired service scaling.");
    const active = yes(env(liveContainer,"PDF_PROCESSING_ENABLED")) && yes(env(liveContainer,"PDF_WORKER_IAM_READY"));
    push(checks,"run-processing-gates",active,
      "Running revision processing/IAM gates must both be enabled.");
    const mounts = liveContainer.volumeMounts ?? [];
    const liveMount = mounts.find(v=>v.mountPath==="/tmp/pdf-worker");
    const volume = live.volumes?.find(v=>v.name===liveMount?.name);
    push(checks,"run-bounded-temp",!!(liveMount && volume?.emptyDir?.medium === "Memory" &&
      ["32Mi","32MiB"].includes(String(volume.emptyDir.sizeLimit)) &&
      env(liveContainer,"PDF_TEMP_ROOT") === "/tmp/pdf-worker"),
      "Running revision needs bounded 32Mi memory volume mounted at /tmp/pdf-worker.");
  }
  if (!iam) cannotRead(checks,"run-iam-policy");
  else {
    const invokers=(iam.bindings??[]).filter(b=>b.role==="roles/run.invoker");
    push(checks,"run-iam-policy",!publicMembers(iam) &&
      invokers.length===1 && !invokers[0].condition &&
      invokers[0].members?.length===1 &&
      invokers[0].members[0]==="serviceAccount:"+TARGET.invokerSA,
      "Only the fixed invoker may have direct Run Invoker grant; inherited IAM still needs separate review.");
  }

  if (!queue) cannotRead(checks,"queue-policy");
  else {
    const rate=queue.rateLimits ?? {};
    const retry=queue.retryConfig ?? {};
    push(checks,"queue-policy",
      queue.name===TARGET.queue && queue.state==="RUNNING" &&
      Number(rate.maxConcurrentDispatches)===1 &&
      Number(rate.maxDispatchesPerSecond)>0 && Number(rate.maxDispatchesPerSecond)<=1 &&
      Number(retry.maxAttempts)===5 && retry.maxRetryDuration==="3600s" &&
      retry.minBackoff==="10s" && retry.maxBackoff==="300s" && !queue.httpTarget,
      "Queue phải RUNNING, concurrency 1, <=1 task/s và retries 5/3600s/10–300s.");
  }
  if (!bucket || !bucketIam) cannotRead(checks,"bucket-private");
  else {
    const pap=bucket.iamConfiguration?.publicAccessPrevention;
    push(checks,"bucket-private",
      (bucket.name===TARGET.bucket || bucket.name==="gs://"+TARGET.bucket) &&
      !publicMembers(bucketIam) && pap==="enforced",
      "Bucket phải đúng tên, không có IAM public và enforce Public Access Prevention.");
  }

  // Never infer these gates from cloud-resource configuration or CI smoke.
  checks.push({id:"producer-identity",result:"BLOCKED",
    message:"Chưa có bằng chứng danh tính VPS độc lập, được duyệt, xác thực và cấp quyền tối thiểu."});
  checks.push({id:"recovery-and-cloud-e2e",result:"BLOCKED",
    message:"Chưa kiểm thử scheduler độc lập, Worker/Tasks/GCS thật và tải PDF từ thiết bị khác."});
  return {
    target:{project:TARGET.project,region:TARGET.region},
    source, checks,
    resourcesVerified:checks.filter(c=>!["producer-identity","recovery-and-cloud-e2e"].includes(c.id)).every(c=>c.result==="PASS"),
    activationAllowed:false,
    note:"READ ONLY. Không sử dụng kết quả này để tự bật PDF; identity/recovery/cloud E2E cần phê duyệt riêng.",
  };
}
function templateConcurrency(svc) {
  return svc?.template?.maxInstanceRequestConcurrency ?? null;
}
/** Node cannot execFileSync a .cmd/.bat shim on Windows. Use cmd.exe solely
 * for the fixed, allowlisted read-only commands defined in READ_COMMANDS.
 * The user cannot supply shell text or arguments to this collector. */
export function gcloudInvocation(args, platform = process.platform) {
  if (platform !== "win32") return { command: "gcloud", args };
  if (!args.every(value => /^[A-Za-z0-9_./:=-]+$/.test(value))) {
    throw new Error("PDF_READINESS_UNSAFE_GCLOUD_ARGUMENT");
  }
  return { command: "cmd.exe", args: ["/d", "/s", "/c", "gcloud " + args.join(" ")] };
}
/** Revision name is learned from the fixed read-only service describe and
 * validated before it can become another fixed gcloud read. Never shell-expand
 * untrusted service fields.
 */
export function revisionReadCommand(service) {
  const status=service?.status;
  const name=status?.latestReadyRevisionName;
  if (typeof name !== "string" || !/^teacher-pdf-worker-[0-9]{5}-[a-z0-9]+$/.test(name) ||
      status?.latestCreatedRevisionName !== name ||
      !Array.isArray(status?.traffic) || status.traffic.length !== 1 ||
      status.traffic[0]?.revisionName !== name || Number(status.traffic[0]?.percent) !== 100)
    return null;
  return ["run","revisions","describe",name,"--project",TARGET.project,
    "--region",TARGET.region,"--format=json"];
}
export function snapshotWithGcloud(run = execFileSync, platform = process.platform) {
  const evidence = {};
  for (const [key,args] of Object.entries(READ_COMMANDS)) {
    try {
      const call = gcloudInvocation(args,platform);
      const output = run(call.command,call.args,{encoding:"utf8",timeout:15000,maxBuffer:1024*1024,
        stdio:["ignore","pipe","pipe"]});
      evidence[key] = JSON.parse(output);
    } catch {
      evidence[key] = null; // Never print command stderr: it may contain sensitive context.
    }
  }
  const revisionArgs=revisionReadCommand(evidence.service);
  evidence.revision=null;
  if (revisionArgs) {
    try {
      const call=gcloudInvocation(revisionArgs,platform);
      const output=run(call.command,call.args,{encoding:"utf8",timeout:15000,maxBuffer:1024*1024,
        stdio:["ignore","pipe","pipe"]});
      evidence.revision=JSON.parse(output);
    } catch { evidence.revision=null; }
  }
  return evidence;
}
export function main(argv=process.argv.slice(2)) {
  if (argv.length===1 && argv[0]==="--help") {
    console.log("node scripts/pdf-cloud-readiness.mjs --gcloud\nnode scripts/pdf-cloud-readiness.mjs --snapshot /path/to/operator-snapshot.json");
    return 0;
  }
  let evidence,source;
  if (argv.length===1 && argv[0]==="--gcloud") {
    evidence=snapshotWithGcloud();source="gcloud-read-only";
  } else if(argv.length===2 && argv[0]==="--snapshot") {
    try { evidence=JSON.parse(readFileSync(argv[1],"utf8"));source="offline-snapshot"; }
    catch { console.error("PDF_READINESS_SNAPSHOT_INVALID"); return 2; }
  } else {
    console.error("Usage: node scripts/pdf-cloud-readiness.mjs --gcloud | --snapshot FILE");
    return 2;
  }
  const report=evaluate(evidence,source);
  console.log(JSON.stringify(report,null,2));
  // Fail closed even if resources match; this command never approves activation.
  return report.resourcesVerified ? 0 : 2;
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode=main();
}
