import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { publicHomeContent } from "../content/publicHome";

function setMeta(name: string, content: string, property = false) {
  const attribute = property ? "property" : "name";
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.append(element);
  }
  element.content = content;
}

export function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const isPublicHome = pathname === "/";
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]') ?? document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = isPublicHome ? `${publicHomeContent.siteUrl}/` : `${publicHomeContent.siteUrl}${pathname}`;
    if (!canonical.parentElement) document.head.append(canonical);

    document.documentElement.lang = "vi";
    document.title = isPublicHome ? publicHomeContent.seo.title : "Quản trị | Teacher Class Hub";
    setMeta("description", isPublicHome ? publicHomeContent.seo.description : "Khu vực quản trị riêng của giáo viên.");
    setMeta("robots", isPublicHome ? "index,follow,max-image-preview:large" : "noindex,nofollow,noarchive");
    setMeta("og:title", publicHomeContent.seo.title, true);
    setMeta("og:description", publicHomeContent.seo.description, true);
    setMeta("og:type", "website", true);
    setMeta("og:url", `${publicHomeContent.siteUrl}/`, true);
    setMeta("og:image", `${publicHomeContent.siteUrl}/images/teacher-hero-1440.webp`, true);
    setMeta("og:locale", "vi_VN", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", publicHomeContent.seo.title);
    setMeta("twitter:description", publicHomeContent.seo.description);
    setMeta("twitter:image", `${publicHomeContent.siteUrl}/images/teacher-hero-1440.webp`);

    const existing = document.getElementById("public-person-structured-data");
    if (isPublicHome) {
      const script = existing ?? document.createElement("script");
      script.id = "public-person-structured-data";
      script.setAttribute("type", "application/ld+json");
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Person",
        name: publicHomeContent.teacherName,
        url: `${publicHomeContent.siteUrl}/`,
        jobTitle: "Giáo viên",
        description: publicHomeContent.description,
      });
      if (!script.parentElement) document.head.append(script);
    } else {
      existing?.remove();
    }
  }, [pathname]);

  return null;
}

