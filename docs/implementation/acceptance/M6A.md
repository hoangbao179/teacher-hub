# M6A Acceptance

- [x] `/` loads without authentication and contains the nine approved sections.
- [x] The hero has the teacher name, positioning, primary Zalo action, phone
  action and an optimized local visual with explicit dimensions.
- [x] No public tuition price or private admin/student data is rendered.
- [x] Contact destinations are valid, external links use safe attributes and
  the phone action uses `tel:`; no `href="#"` or enabled fake control exists.
- [x] Long-form YouTube iframes are absent before interaction and created after
  an accessible user action; invalid URLs degrade to a clear unavailable state.
- [x] Teacher content and contact configuration live in one documented module.
- [x] Title, description, canonical, Open Graph/Twitter metadata and justified
  structured data are present; robots and sitemap expose only public pages.
- [x] Admin login and protected admin pages use `noindex` metadata.
- [x] Landmarks, one logical H1, headings, alt text, focus states, keyboard
  controls, contrast and reduced-motion behavior are practical.
- [x] The page has no horizontal overflow at 360px, no autoplay audio, no eager
  long-video iframe and no major image layout shift.
- [x] Homepage E2E covers public access, contacts, lazy video, metadata,
  reduced-motion, private-data absence, 360px overflow and admin login access.
- [x] `npm run check:fast`, `npm run test:e2e` and `npm run build` pass.
