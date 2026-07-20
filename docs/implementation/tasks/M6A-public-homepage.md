# M6A — Public Homepage

## Goal

Replace the public placeholder at `/` with a polished, mobile-first, accessible
and fast marketing Homepage. The page remains unauthenticated and contains no
student-management data or public tuition price.

## Scope

- Header, hero, teacher introduction, teaching method, learning programs,
  click-to-load learning videos, testimonials, contact CTA and footer.
- One source-controlled content/config module for teacher copy, links, videos
  and deployment-time public URL.
- Optimized local hero artwork plus lazy below-the-fold media.
- Valid Zalo, `tel:` and Facebook actions; no API integration and no fake button.
- Title, description, canonical, Open Graph/Twitter metadata, semantic headings,
  structured Person data, favicon, robots and public-only sitemap.
- Admin pages set `noindex`; admin login remains reachable.
- Automated public-route, contact, media, metadata, reduced-motion and 360px
  overflow coverage.

## Exclusions

- CMS, public tuition pricing, long self-hosted video, autoplay audio,
  notifications, Zalo OA/API and private admin data.

## Required verification

```bash
npm run check:fast
npm run test:e2e
npm run build
```

M6B must not begin until the M6A verification report ends in `PASS`.
