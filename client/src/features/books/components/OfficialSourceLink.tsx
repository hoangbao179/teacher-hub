import { Button } from "@mui/material";

export function OfficialSourceLink({ href, mobile = false }: { href: string; mobile?: boolean }) {
  return (
    <Button
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      sx={{ display: mobile ? { xs: "flex", md: "none" } : { xs: "none", md: "inline-flex" }, minHeight: 44, whiteSpace: "nowrap" }}
    >
      Mở trên trang NXBGD
    </Button>
  );
}
