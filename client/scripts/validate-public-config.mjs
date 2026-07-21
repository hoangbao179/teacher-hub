/* global process, console */
import path from "node:path";
import { URL } from "node:url";
import { loadEnv } from "vite";

const clientRoot = path.resolve(import.meta.dirname, "..");
const required = [
  "VITE_PUBLIC_SITE_URL", "VITE_PUBLIC_TEACHER_NAME", "VITE_PUBLIC_BRAND_NAME",
  "VITE_PUBLIC_SUBJECT_LINE", "VITE_PUBLIC_DESCRIPTION", "VITE_PUBLIC_INTRODUCTION",
  "VITE_PUBLIC_ZALO_URL", "VITE_PUBLIC_PHONE_DISPLAY", "VITE_PUBLIC_PHONE_E164",
  "VITE_PUBLIC_FACEBOOK_URL", "VITE_PUBLIC_HERO_MOBILE_URL", "VITE_PUBLIC_HERO_DESKTOP_URL",
  "VITE_PUBLIC_VIDEOS_JSON", "VITE_PUBLIC_TESTIMONIALS_JSON", "VITE_PUBLIC_SEO_TITLE",
  "VITE_PUBLIC_SEO_DESCRIPTION",
];
const placeholder = /example(?:\.|$)|localhost|0900\s*000\s*000|84900000000|cô giáo an|cùng cô an|replace|change-me|placeholder|sample|minh họa/i;

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
  for (const key of ["VITE_PUBLIC_HERO_MOBILE_URL", "VITE_PUBLIC_HERO_DESKTOP_URL"])
    if (!/^\/(?!\/)|^https:\/\//.test(env[key] ?? "")) errors.push(`${key} must be a root-relative or HTTPS asset URL`);
  for (const [key, fields] of [["VITE_PUBLIC_VIDEOS_JSON", ["title", "description", "url"]], ["VITE_PUBLIC_TESTIMONIALS_JSON", ["quote", "attribution"]]]) {
    try {
      const items = JSON.parse(env[key] ?? "");
      if (!Array.isArray(items) || !items.length || items.some((item) => !fields.every((field) => typeof item?.[field] === "string" && item[field].trim()))) errors.push(`${key} must be a non-empty array with ${fields.join(", ")}`);
    } catch { errors.push(`${key} must be valid JSON`); }
  }
  return [...new Set(errors)];
}

const validFixture = {
  VITE_PUBLIC_CONTENT_MODE: "production", VITE_PUBLIC_SITE_URL: "https://teacherhub.vn",
  VITE_PUBLIC_TEACHER_NAME: "Cô Nguyễn", VITE_PUBLIC_BRAND_NAME: "Lớp Toán Cô Nguyễn",
  VITE_PUBLIC_SUBJECT_LINE: "Hiểu bản chất, tiến bộ mỗi ngày", VITE_PUBLIC_DESCRIPTION: "Thông tin lớp học đã được giáo viên xác nhận.",
  VITE_PUBLIC_INTRODUCTION: "Giáo viên đồng hành theo lộ trình phù hợp với từng học sinh.",
  VITE_PUBLIC_ZALO_URL: "https://zalo.me/84912345678", VITE_PUBLIC_PHONE_DISPLAY: "0912 345 678",
  VITE_PUBLIC_PHONE_E164: "+84912345678", VITE_PUBLIC_FACEBOOK_URL: "https://www.facebook.com/loptoancogiao",
  VITE_PUBLIC_HERO_MOBILE_URL: "/images/teacher-hero-720.webp", VITE_PUBLIC_HERO_DESKTOP_URL: "/images/teacher-hero-1440.webp",
  VITE_PUBLIC_VIDEOS_JSON: '[{"title":"Bài học","description":"Giới thiệu","url":"https://youtu.be/abc123"}]',
  VITE_PUBLIC_TESTIMONIALS_JSON: '[{"quote":"Phản hồi đã được cho phép công khai","attribution":"Phụ huynh lớp 6"}]',
  VITE_PUBLIC_SEO_TITLE: "Lớp Toán Cô Nguyễn", VITE_PUBLIC_SEO_DESCRIPTION: "Thông tin lớp Toán và phương pháp học.",
};

if (process.argv.includes("--self-test")) {
  if (validatePublicConfig(validFixture).length) throw new Error("Valid marketing fixture was rejected");
  if (!validatePublicConfig({ ...validFixture, VITE_PUBLIC_PHONE_DISPLAY: "0900 000 000" }).length) throw new Error("Placeholder marketing fixture was accepted");
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
