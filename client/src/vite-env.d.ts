/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_CONTENT_MODE?: "demo" | "production";
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_PUBLIC_TEACHER_NAME?: string;
  readonly VITE_PUBLIC_BRAND_NAME?: string;
  readonly VITE_PUBLIC_HERO_HEADING?: string;
  readonly VITE_PUBLIC_DESCRIPTION?: string;
  readonly VITE_PUBLIC_INTRODUCTION?: string;
  readonly VITE_PUBLIC_ZALO_URL?: string;
  readonly VITE_PUBLIC_HERO_MOBILE_URL?: string;
  readonly VITE_PUBLIC_HERO_DESKTOP_URL?: string;
  readonly VITE_PUBLIC_HERO_ALT_MOBILE_URL?: string;
  readonly VITE_PUBLIC_HERO_ALT_DESKTOP_URL?: string;
  readonly VITE_PUBLIC_HERO_SECONDARY_MOBILE_URL?: string;
  readonly VITE_PUBLIC_HERO_SECONDARY_DESKTOP_URL?: string;
  readonly VITE_PUBLIC_TEACHER_PHOTO_URL?: string;
  readonly VITE_PUBLIC_TEACHER_PHOTO_ALT?: string;
  readonly VITE_PUBLIC_TEACHER_PHOTO_FOCAL_POSITION?: string;
  readonly VITE_PUBLIC_OG_IMAGE_URL?: string;
  readonly VITE_PUBLIC_VIDEOS_JSON?: string;
  readonly VITE_PUBLIC_TESTIMONIALS_JSON?: string;
  readonly VITE_PUBLIC_SEO_TITLE?: string;
  readonly VITE_PUBLIC_SEO_DESCRIPTION?: string;
}
