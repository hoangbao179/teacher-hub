import { publicHomeContent } from "../../../content/publicHome.ts";
import { enabledPublicBooks, findPublicBook } from "../content/publicBookCatalog.ts";

export interface BookRouteMetadata {
  title: string;
  description: string;
  robots: string;
  canonical?: string;
  valid: boolean;
}

export const stableBookPathnames = [
  "/sach",
  ...enabledPublicBooks.map((book) => `/sach/global-success/${book.slug}`),
] as const;

export function bookRouteMetadata(pathname: string): BookRouteMetadata {
  if (pathname === "/sach") {
    return {
      title: "Tủ sách Tiếng Anh Global Success lớp 1–9 | Tiếng Anh cô Vy",
      description: "Chọn sách Tiếng Anh Global Success lớp 1–9, lật trang và nghe bài trực tiếp trong sách cùng cô Vy.",
      robots: "index,follow,max-image-preview:large",
      canonical: `${publicHomeContent.siteUrl}/sach`,
      valid: true,
    };
  }

  const match = pathname.match(/^\/sach\/global-success\/([^/]+)$/);
  const book = match ? findPublicBook(match[1]) : undefined;
  if (!book) {
    return {
      title: `Không tìm thấy sách | ${publicHomeContent.brandName}`,
      description: "Cuốn sách bạn tìm chưa có trong Tủ sách cô Vy.",
      robots: "noindex,follow",
      valid: false,
    };
  }

  return {
    title: `${book.shortTitle} Global Success có audio | Tiếng Anh cô Vy`,
    description: `Xem ${book.title}, lật trang, phóng to và nhấn biểu tượng loa để nghe bài trực tiếp trong sách.`,
    robots: "index,follow,max-image-preview:large",
    canonical: `${publicHomeContent.siteUrl}/sach/global-success/${book.slug}`,
    valid: true,
  };
}
