import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { publicHomeContent, publicHomeStructuredData } from "../content/publicHome";

function setMeta(name: string, value: string, property = false) {
  const attribute = property ? "property" : "name";
  const element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (element) element.content = value;
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
      if (!structuredData) {
        const script = document.createElement("script");
        script.id = "public-home-structured-data";
        script.type = "application/ld+json";
        script.textContent = JSON.stringify(publicHomeStructuredData);
        document.head.append(script);
      }
      return;
    }

    const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
    document.title = isAdmin ? `Quản trị | ${publicHomeContent.brandName}` : `Không tìm thấy trang | ${publicHomeContent.brandName}`;
    setMeta("description", isAdmin ? "Khu vực quản trị riêng của giáo viên." : "Trang bạn tìm không tồn tại. Quay về trang chủ lớp tiếng Anh cô Vy tại Huế.");
    setMeta("robots", isAdmin ? "noindex,nofollow,noarchive" : "noindex,follow");
    structuredData?.remove();
  }, [pathname]);

  return null;
}
