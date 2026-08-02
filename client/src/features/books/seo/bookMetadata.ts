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
  ...enabledPublicBooks.map((book) => `/sach/${book.seriesSlug}/${book.slug}`),
] as const;

export function bookRouteMetadata(pathname: string): BookRouteMetadata {
  if (pathname === "/sach") {
    return {
      title: "Tủ sách Tiếng Anh lớp 1–9 | Tiếng Anh cô Vy",
      description: "Đọc sách học sinh và tài liệu giáo viên Tiếng Anh theo lớp từ nguồn chính thức Nhà xuất bản Giáo dục Việt Nam.",
      robots: "index,follow,max-image-preview:large",
      canonical: `${publicHomeContent.siteUrl}/sach`,
      valid: true,
    };
  }

  const match = pathname.match(/^\/sach\/([^/]+)\/([^/]+)(\/nghe)?$/);
  const book = match ? findPublicBook(match[1], match[2]) : undefined;
  if (!book) {
    return {
      title: `Không tìm thấy sách | ${publicHomeContent.brandName}`,
      description: "Cuốn sách bạn tìm chưa có trong Tủ sách cô Vy.",
      robots: "noindex,follow",
      valid: false,
    };
  }

  if (match?.[3] === "/nghe") {
    if (!book.interactiveAudioUrl || book.bookType !== "STUDENT_BOOK") {
      return {
        title: `Không tìm thấy bản nghe | ${publicHomeContent.brandName}`,
        description: "Bản nghe tương tác này chưa có trong Tủ sách cô Vy.",
        robots: "noindex,follow",
        valid: false,
      };
    }
    return {
      title: `Nghe tương tác ${book.shortTitle} | Tiếng Anh cô Vy`,
      description: `Mở bản nghe tương tác bên ngoài cho ${book.title}.`,
      robots: "noindex,follow",
      valid: true,
    };
  }

  return {
    title: `${book.shortTitle} | Tiếng Anh cô Vy`,
    description: `Đọc ${book.title} từ nguồn chính thức Nhà xuất bản Giáo dục Việt Nam.`,
    robots: "index,follow,max-image-preview:large",
    canonical: `${publicHomeContent.siteUrl}/sach/${book.seriesSlug}/${book.slug}`,
    valid: true,
  };
}
