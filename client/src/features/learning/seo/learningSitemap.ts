import { stableLearningPathnames } from "./learningMetadata.ts";

const SITE_URL = "https://tienganhcovy.com";

const escapeXml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export const productionSitemapPathnames = ["/", ...stableLearningPathnames] as const;

export function generateProductionSitemapXml(pathnames: readonly string[] = productionSitemapPathnames): string {
  const uniquePathnames = [...new Set(pathnames)];
  const urls = uniquePathnames.map((pathname) => {
    const url = pathname === "/" ? `${SITE_URL}/` : `${SITE_URL}${pathname}`;
    return `  <url><loc>${escapeXml(url)}</loc></url>`;
  });
  return [`<?xml version="1.0" encoding="UTF-8"?>`, `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`, ...urls, `</urlset>`, ""].join("\n");
}
