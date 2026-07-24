import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { publicHomeContent, publicHomeStructuredData } from "../content/publicHome";
import { learningRouteMetadata } from "../features/learning/seo/learningMetadata";

function setMeta(name: string, value: string, property = false) {
  const attribute = property ? "property" : "name";
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!element) { element = document.createElement("meta"); element.setAttribute(attribute, name); document.head.append(element); }
  element.content = value;
}

function setCanonical(value?: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!value) { element?.remove(); return; }
  if (!element) { element = document.createElement("link"); element.rel = "canonical"; document.head.append(element); }
  element.href = value;
}

export function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const isPublicHome = pathname === "/";
    const structuredData = document.getElementById("public-home-structured-data");

    document.documentElement.lang = "vi";
    if (isPublicHome) {
      document.title = publicHomeContent.seo.title;
      setMeta("description", publicHomeContent.seo.description);
      setMeta("robots", "index,follow,max-image-preview:large");
      setCanonical(`${publicHomeContent.siteUrl}/`);
      setMeta("og:title", publicHomeContent.seo.title, true);
      setMeta("og:description", publicHomeContent.seo.description, true);
      setMeta("og:url", `${publicHomeContent.siteUrl}/`, true);
      if (!structuredData) {
        const script = document.createElement("script");
        script.id = "public-home-structured-data";
        script.type = "application/ld+json";
        script.textContent = JSON.stringify(publicHomeStructuredData);
        document.head.append(script);
      }
      return;
    }

    if (pathname === "/hoc" || pathname.startsWith("/hoc/")) {
      const metadata = learningRouteMetadata(pathname);
      document.title = metadata.title;
      setMeta("description", metadata.description);
      setMeta("robots", metadata.robots);
      setCanonical(metadata.canonical);
      setMeta("og:title", metadata.title, true);
      setMeta("og:description", metadata.description, true);
      setMeta("og:url", metadata.canonical ?? `${publicHomeContent.siteUrl}${pathname}`, true);
      setMeta("og:type", "website", true);
      structuredData?.remove();
      return;
    }

    const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
    document.title = isAdmin ? `Quản trị | ${publicHomeContent.brandName}` : `Không tìm thấy trang | ${publicHomeContent.brandName}`;
    setMeta("description", isAdmin ? "Khu vực quản trị riêng của giáo viên." : "Trang bạn tìm không tồn tại. Quay về trang chủ lớp tiếng Anh cô Vy tại Huế.");
    setMeta("robots", isAdmin ? "noindex,nofollow,noarchive" : "noindex,follow");
    setCanonical(undefined);
    structuredData?.remove();
  }, [pathname]);

  return null;
}
