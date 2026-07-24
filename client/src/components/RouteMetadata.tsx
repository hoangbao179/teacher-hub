import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { publicHomeContent, publicHomeStructuredData } from "../content/publicHome";
import { levelBySlug } from "../features/learning/content/vocabularyCatalog";

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

    if (pathname === "/hoc" || pathname.startsWith("/hoc/")) {
      const segments = pathname.split("/").filter(Boolean);
      const level = segments.length === 2 ? levelBySlug(segments[1]) : undefined;
      const validLearningRoute = pathname === "/hoc" || Boolean(level?.available);
      document.title = validLearningRoute
        ? level ? `${level.name} | Góc học tiếng Anh cùng cô Vy` : "Góc học tiếng Anh miễn phí cùng cô Vy"
        : `Không tìm thấy bài học | ${publicHomeContent.brandName}`;
      setMeta("description", validLearningRoute
        ? level ? `Chọn chủ đề từ vựng ${level.name} và học miễn phí cùng cô Vy.` : "Chọn cấp độ từ mầm non đến lớp 9 và học từ vựng tiếng Anh miễn phí cùng cô Vy."
        : "Bài học hoặc cấp độ này không tồn tại.");
      setMeta("robots", validLearningRoute ? "index,follow,max-image-preview:large" : "noindex,follow");
      structuredData?.remove();
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
