# V1 release-candidate checklist

## Repository evidence

- [x] Node 24.18.0/npm 12.0.1 confirmed and `npm ci` clean install performed.
- [x] Migrations, production build, `check:full`, E2E, Homepage/admin mobile and Excel reviewed.
- [x] Environment validation, secret placeholders, dependency/license/security review completed.
- [x] Health/readiness, login, admin bootstrap and restore procedures documented.
- [x] M6A, M6B, M6C and M6D reports end in PASS.

## Deployment operator gate (repeat per environment)

- [ ] Git/tag is clean and approved; real public identity/contact/domain configured.
- [ ] Production secrets verified out of band and first admin credentials rotated.
- [ ] Pre-deployment backup taken and restore drill reviewed.
- [ ] Docker images built; MySQL/API/web health and observed resource usage recorded.
- [ ] HTTPS, firewall, persistent volume and retention policy verified.
- [ ] Known limitations accepted by the owner.

Unchecked operator items block a real deployment, not creation of the reviewable
release-candidate artifact. Independent full-system review remains mandatory.

RELEASE_CANDIDATE_READY
