import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function adminRobotsHeader(): Plugin {
  const setHeader = (
    req: { url?: string },
    res: { setHeader(name: string, value: string): void },
    next: () => void,
  ) => {
    if (req.url === "/admin" || req.url?.startsWith("/admin/")) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    next();
  };

  return {
    name: "admin-robots-header",
    configureServer(server) {
      server.middlewares.use(setHeader);
    },
    configurePreviewServer(server) {
      server.middlewares.use(setHeader);
    },
  };
}

export default defineConfig({
  plugins: [react(), adminRobotsHeader()],
  server: {
    port: 5173,
    strictPort: true,
    host: "0.0.0.0",
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/health": { target: "http://localhost:4000" },
      "/ready": { target: "http://localhost:4000" },
    },
  },
});
