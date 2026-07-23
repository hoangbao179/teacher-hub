import { CssBaseline, ThemeProvider } from "@mui/material";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { theme } from "./theme";

export function renderHomePage() {
  return renderToString(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={["/"]}>
        <HomePage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

export function renderNotFoundPage() {
  return renderToString(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={["/404.html"]}>
        <NotFoundPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}
