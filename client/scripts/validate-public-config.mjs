/* global process, console */
import path from "node:path";
import { URL } from "node:url";
import { loadEnv } from "vite";

const clientRoot = path.resolve(import.meta.dirname, "..");
const required = [
  "VITE_PUBLIC_SITE_URL", "VITE_PUBLIC_TEACHER_NAME", "VITE_PUBLIC_BRAND_NAME",
  "VITE_PUBLIC_HERO_HEADING", "VITE_PUBLIC_DESCRIPTION", "VITE_PUBLIC_INTRODUCTION",
  "VITE_PUBLIC_ZALO_URL", "VITE_PUBLIC_PHONE_DISPLAY", "VITE_PUBLIC_PHONE_E164",
  "VITE_PUBLIC_FACEBOOK_URL", "VITE_PUBLIC_HERO_MOBILE_URL", "VITE_PUBLIC_HERO_DESKTOP_URL",
  "VITE_PUBLIC_HERO_ALT_MOBILE_URL", "VITE_PUBLIC_HERO_ALT_DESKTOP_URL",
  "VITE_PUBLIC_HERO_SECONDARY_MOBILE_URL", "VITE_PUBLIC_HERO_SECONDARY_DESKTOP_URL",
  "VITE_PUBLIC_TEACHER_PHOTO_URL", "VITE_PUBLIC_TEACHER_PHOTO_ALT", "VITE_PUBLIC_TEACHER_PHOTO_FOCAL_POSITION", "VITE_PUBLIC_OG_IMAGE_URL",
  "VITE_PUBLIC_VIDEOS_JSON", "VITE_PUBLIC_TESTIMONIALS_JSON", "VITE_PUBLIC_SEO_TITLE",
  "VITE_PUBLIC_SEO_DESCRIPTION",
];
const placeholder = /example(?:\.|$)|\.invalid(?:\/|$)|localhost|0900\s*000\s*000|84000000000|84900000000|cô giáo an|cùng cô an|chưa cấu hình|replace|change-me|placeholder|sample|minh họa/i;

export function validatePublicConfig(env) {
  const errors = [];
  if (env.VITE_PUBLIC_CONTENT_MODE !== "production") errors.push("VITE_PUBLIC_CONTENT_MODE must be production");
  for (const key of required) {
    const current = String(env[key] ?? "").trim();
    if (!current) errors.push(`${key} is required`);
    else if (placeholder.test(current)) errors.push(`${key} still contains demo/placeholder content`);
  }
  const checkUrl = (key, hosts) => {
    try {
      const url = new URL(env[key]);
      if (url.protocol !== "https:" || (hosts && !hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)))) errors.push(`${key} must use an approved HTTPS URL`);
      if (key === "VITE_PUBLIC_FACEBOOK_URL" && url.pathname.replaceAll("/", "") === "") errors.push(`${key} must not target the Facebook root`);
    } catch { errors.push(`${key} must be a valid URL`); }
  };
  checkUrl("VITE_PUBLIC_SITE_URL");
  checkUrl("VITE_PUBLIC_ZALO_URL", ["zalo.me"]);
  checkUrl("VITE_PUBLIC_FACEBOOK_URL", ["facebook.com"]);
  if (!/^\+[1-9]\d{7,14}$/.test(env.VITE_PUBLIC_PHONE_E164 ?? "")) errors.push("VITE_PUBLIC_PHONE_E164 must use E.164 format");
  for (const key of ["VITE_PUBLIC_HERO_MOBILE_URL", "VITE_PUBLIC_HERO_DESKTOP_URL", "VITE_PUBLIC_HERO_ALT_MOBILE_URL", "VITE_PUBLIC_HERO_ALT_DESKTOP_URL", "VITE_PUBLIC_HERO_SECONDARY_MOBILE_URL", "VITE_PUBLIC_HERO_SECONDARY_DESKTOP_URL", "VITE_PUBLIC_TEACHER_PHOTO_URL", "VITE_PUBLIC_OG_IMAGE_URL"])
    if (!/^\/(?!\/)|^https:\/\//.test(env[key] ?? "")) errors.push(`${key} must be a root-relative or HTTPS asset URL`);
  const heroMedia = [env.VITE_PUBLIC_HERO_DESKTOP_URL, env.VITE_PUBLIC_HERO_ALT_DESKTOP_URL, env.VITE_PUBLIC_HERO_SECONDARY_DESKTOP_URL];
  if (new Set(heroMedia).size !== heroMedia.length) errors.push("The three hero slides must use distinct media URLs");
  try {
    const items = JSON.parse(env.VITE_PUBLIC_VIDEOS_JSON ?? "");
    const fields = ["title", "description", "url"];
    if (!Array.isArray(items) || !items.length || items.some((item) => !fields.every((field) => typeof item?.[field] === "string" && item[field].trim())))
      errors.push(`VITE_PUBLIC_VIDEOS_JSON must be a non-empty array with ${fields.join(", ")}`);
  } catch { errors.push("VITE_PUBLIC_VIDEOS_JSON must be valid JSON"); }
  try {
    const items = JSON.parse(env.VITE_PUBLIC_TESTIMONIALS_JSON ?? "");
    const stringFields = ["id", "guardianLabel", "studentLevel", "location", "quote"];
    if (!Array.isArray(items) || items.some((item) =>
      !stringFields.every((field) => typeof item?.[field] === "string" && item[field].trim()) ||
      typeof item?.verified !== "boolean" || typeof item?.published !== "boolean" ||
      (item.date != null && (typeof item.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)))))
      errors.push(`VITE_PUBLIC_TESTIMONIALS_JSON must be an array with ${stringFields.join(", ")}, verified and published`);
    if (Array.isArray(items) && items.some((item) => item?.published === true && item?.verified !== true))
      errors.push("VITE_PUBLIC_TESTIMONIALS_JSON cannot publish an unverified testimonial");
  } catch { errors.push("VITE_PUBLIC_TESTIMONIALS_JSON must be valid JSON"); }
  return [...new Set(errors)];
}

const validFixture = {
  VITE_PUBLIC_CONTENT_MODE: "production", VITE_PUBLIC_SITE_URL: "https://teacherhub.vn",
  VITE_PUBLIC_TEACHER_NAME: "Cô Vy", VITE_PUBLIC_BRAND_NAME: "Lớp học cô Vy",
  VITE_PUBLIC_HERO_HEADING: "Tiếng Anh vững nền tảng", VITE_PUBLIC_DESCRIPTION: "Thông tin lớp học đã được giáo viên xác nhận.",
  VITE_PUBLIC_INTRODUCTION: "Giáo viên đồng hành theo lộ trình phù hợp với từng học sinh.",
  VITE_PUBLIC_ZALO_URL: "https://zalo.me/84912345678", VITE_PUBLIC_PHONE_DISPLAY: "0912 345 678",
  VITE_PUBLIC_PHONE_E164: "+84912345678", VITE_PUBLIC_FACEBOOK_URL: "https://www.facebook.com/lophocanhngucovy",
  VITE_PUBLIC_HERO_MOBILE_URL: "/images/teacher-english-hero-720.jpg", VITE_PUBLIC_HERO_DESKTOP_URL: "/images/teacher-english-hero-1440.jpg",
  VITE_PUBLIC_HERO_ALT_MOBILE_URL: "/images/teacher-hero-720.webp", VITE_PUBLIC_HERO_ALT_DESKTOP_URL: "/images/teacher-hero-1440.webp",
  VITE_PUBLIC_HERO_SECONDARY_MOBILE_URL: "/images/teacher-secondary-study-720.jpg", VITE_PUBLIC_HERO_SECONDARY_DESKTOP_URL: "/images/teacher-secondary-study-1440.jpg",
  VITE_PUBLIC_TEACHER_PHOTO_URL: "/images/teacher-hero-720.webp", VITE_PUBLIC_TEACHER_PHOTO_ALT: "Không gian dạy học tiếng Anh của cô Vy", VITE_PUBLIC_TEACHER_PHOTO_FOCAL_POSITION: "center", VITE_PUBLIC_OG_IMAGE_URL: "/images/teacher-english-hero-1440.jpg",
  VITE_PUBLIC_VIDEOS_JSON: '[{"title":"Bài học","description":"Giới thiệu","url":"https://youtu.be/abc123"}]',
  VITE_PUBLIC_TESTIMONIALS_JSON: '[{"id":"verified-1","guardianLabel":"Phụ huynh lớp 6","studentLevel":"Lớp 6","location":"Huế","quote":"Phản hồi đã được cho phép công khai","verified":true,"published":true}]',
  VITE_PUBLIC_SEO_TITLE: "Lớp học tiếng Anh cô Vy", VITE_PUBLIC_SEO_DESCRIPTION: "Thông tin lớp tiếng Anh và phương pháp học.",
};

if (process.argv.includes("--self-test")) {
  if (validatePublicConfig(validFixture).length) throw new Error("Valid marketing fixture was rejected");
  if (!validatePublicConfig({ ...validFixture, VITE_PUBLIC_PHONE_DISPLAY: "0900 000 000" }).length) throw new Error("Placeholder marketing fixture was accepted");
  if (!validatePublicConfig({ ...validFixture, VITE_PUBLIC_SITE_URL: "https://configure-public-domain.invalid" }).length) throw new Error("Placeholder public domain was accepted");
  if (!validatePublicConfig({ ...validFixture, VITE_PUBLIC_TEACHER_NAME: "Cô giáo An" }).length) throw new Error("Old demo teacher was accepted");
  if (!validatePublicConfig({ ...validFixture, VITE_PUBLIC_TEACHER_NAME: "replace-with-teacher" }).length) throw new Error("Placeholder teacher was accepted");
  if (!validatePublicConfig({ ...validFixture, VITE_PUBLIC_ZALO_URL: "https://zalo.me/84000000000" }).length) throw new Error("Placeholder Zalo was accepted");
  if (!validatePublicConfig({ ...validFixture, VITE_PUBLIC_PHONE_E164: "+84000000000" }).length) throw new Error("Placeholder E.164 phone was accepted");
  if (!validatePublicConfig({ ...validFixture, VITE_PUBLIC_TESTIMONIALS_JSON: '[{"id":"unsafe","guardianLabel":"Phụ huynh","studentLevel":"Lớp 7","location":"Huế","quote":"Chưa xác minh","verified":false,"published":true}]' }).some((item) => item.includes("unverified"))) throw new Error("Published unverified testimonial was accepted");
  if (validatePublicConfig({ ...validFixture, VITE_PUBLIC_TESTIMONIALS_JSON: "[]" }).length) throw new Error("Empty testimonial fallback configuration was rejected");
  if (!validatePublicConfig({ ...validFixture, VITE_PUBLIC_SEO_TITLE: "" }).length) throw new Error("Missing SEO title was accepted");
  if (!validatePublicConfig({ ...validFixture, VITE_PUBLIC_SEO_DESCRIPTION: "" }).length) throw new Error("Missing SEO description was accepted");
  const confidentialProbe = "confidential-value-must-not-be-printed";
  if (validatePublicConfig({ ...validFixture, VITE_PUBLIC_SITE_URL: confidentialProbe }).join("\n").includes(confidentialProbe)) throw new Error("Validator exposed a confidential input value");
  console.log("Public marketing validation self-test passed");
} else {
  const env = { ...loadEnv("production", clientRoot, ""), ...process.env };
  const errors = validatePublicConfig(env);
  if (errors.length) {
    console.error(errors.map((item) => `- ${item}`).join("\n"));
    process.exit(1);
  }
  console.log("Production public marketing configuration is valid");
}
