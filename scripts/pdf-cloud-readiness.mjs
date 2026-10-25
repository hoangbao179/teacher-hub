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
    push(checks,"run-runtime-sa",(spec.serviceAccountName ?? spec.serviceAccount) === TARGET.runtimeSA,
      "Runtime chỉ dùng service account riêng của Worker.");
    push(checks,"run-immutable-image",/@sha256:[a-f0-9]{64}$/.test(container.image ?? ""),
      "Revision phải dùng image digest bất biến.");
    push(checks,"run-capacity",Number(spec.containerConcurrency ?? templateConcurrency(svc)) === 1,
      "Worker chỉ được nhận một job đồng thời mỗi instance.");
    const status=svc.status ?? {};
    const traffic=status.traffic;
    const ready=status.latestReadyRevisionName;
    push(checks,"run-live-traffic",typeof ready==="string" && !!ready &&
      Array.isArray(traffic) && traffic.length===1 && Number(traffic[0]?.percent)===100 &&
      traffic[0]?.revisionName===ready &&
      typeof svc.metadata?.generation==="number" &&
      status.observedGeneration===svc.metadata.generation,
      "Traffic must reach only the latest ready revision with observed generation matching desired generation.");
    const resources=container.resources?.limits ?? {};
    const template=svc.spec?.template ?? {};
    const autoscale={...svc.metadata?.annotations,...template.metadata?.annotations};
    push(checks,"run-resource-budget",resources.cpu==="1" && resources.memory==="2Gi" &&
      Number(spec.timeoutSeconds)===30 &&
      Number(autoscale["autoscaling.knative.dev/maxScale"])>=1 &&
      Number(autoscale["autoscaling.knative.dev/maxScale"])<=3 &&
      (autoscale["autoscaling.knative.dev/minScale"]??"0")==="0",
      "Verify live CPU 1, RAM 2Gi, timeout 30s, min instances 0, max instances <=3.");
    const active = yes(env(container,"PDF_PROCESSING_ENABLED")) && yes(env(container,"PDF_WORKER_IAM_READY"));
    push(checks,"run-processing-gates",active,
      "Processing/IAM gates chưa cùng bật; health-only không xử lý PDF.");
    const mounts = container.volumeMounts ?? [];
    const mount = mounts.find(v=>v.mountPath==="/tmp/pdf-worker");
    const volume = spec.volumes?.find(v=>v.name===mount?.name);
    push(checks,"run-bounded-temp",!!(mount && volume?.emptyDir?.medium === "Memory" &&
      ["32Mi","32MiB"].includes(String(volume.emptyDir.sizeLimit)) &&
      env(container,"PDF_TEMP_ROOT") === "/tmp/pdf-worker"),
      "Worker cần in-memory volume 32Mi giới hạn và mount đúng /tmp/pdf-worker.");
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
