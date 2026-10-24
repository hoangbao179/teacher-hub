# PDF producer identity and durable dispatch

Status: proposed for production identity; accepted local implementation boundary.

## Context

The external VPS has no attested workload identity or approved issuer. A boolean
feature flag cannot create one. Service-account keys, personal gcloud credentials
and GitHub verifier federation are prohibited. The VPS has 1.5 GB RAM/1 vCPU/15 GB
shared with MySQL and web services; no PDF processing belongs there.

## Decision

Keep production unavailable until an operator approves and verifies an independent
short-lived workload identity. Implement provider interfaces, controlled fakes and
an inert-by-default REST adapter accepting an explicitly verified token supplier.
The application factory supplies no production credentials and cannot activate
submission merely through environment flags. No cloud resource is created here.

Preferred candidate: dedicated OIDC workload federation with an existing trusted
issuer that attests this VPS workload, exact audience/subject restrictions and a
dedicated producer SA. The issuer must independently authenticate the machine,
protect signing keys, rotate short-lived subject tokens and support revocation.
Self-signed VPS JWTs do not independently establish trust. No such issuer has been
identified or approved; implementation of token acquisition remains blocked.

Use job rows as a transactional outbox, deterministic task names and expiring DB
leases. Transactions only record intent/updates; network calls run after commit.
Bounded request-driven reconciliation plus a one-shot recovery CLI avoids a daemon.
Missing tasks are ambiguous, never proof of failure; overdue missing results become
RESULT_UNCONFIRMED, with late-result polling until expiry. Only positive exhausted
attempt evidence becomes RETRY_EXHAUSTED.

## Alternatives

A separately authenticated broker/gateway could hold cloud privileges and validate
VPS requests using an independent identity or mTLS. This adds certificate/key
custody, rotation/revocation, replay protection, another service, logs, requests,
network egress and operational cost. No public gateway or broker is approved.
Moving the producer to an attested cloud runtime changes deployment/architecture
and costs; it needs separate approval. Static SA keys and public worker access are
rejected. IAM keyless signing would need signBlob authority; use bounded authenticated
streaming as a disabled production alternative until download architecture approval.

## Consequences and permissions

Local MySQL/fake tests can establish orchestration correctness, not cloud readiness.
Federation needs Workload Identity User on the dedicated producer SA for only the
approved subject. Producer needs tasks.create/tasks.get and queues.get on the exact
queue, actAs on invoker SA and objects.get on the exact results bucket (prefer custom
roles over broader viewer roles). Invoker needs service-scoped run.invoker; Cloud
Tasks service agent needs its standard token-minting role. Runtime worker needs
bucket objects.create/get. Producer has no Run deployment, IAM mutation or object
write/delete privilege. Review all bindings including inherited access manually.
Federation/token exchange, Tasks operations, GCS reads/egress, issuer/broker hosting
and logging incur workload-dependent costs; no monthly estimate is validated.

References: [external federation](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-other-providers),
[queue retries](https://docs.cloud.google.com/tasks/docs/configuring-queues).
