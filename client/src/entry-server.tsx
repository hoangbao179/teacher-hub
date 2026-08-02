import { CssBaseline, ThemeProvider } from "@mui/material";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { LearningHubPage } from "./features/learning/pages/LearningHubPage";
import { LearningLevelPage } from "./features/learning/pages/LearningLevelPage";
import { LearningUnitPage } from "./features/learning/pages/LearningUnitPage";
import { learningRouteMetadata, stableLearningPathnames } from "./features/learning/seo/learningMetadata";
import { BookLibraryPage } from "./features/books/pages/BookLibraryPage";
import { BookPreviewPage } from "./features/books/pages/BookPreviewPage";
import { bookRouteMetadata, stableBookPathnames } from "./features/books/seo/bookMetadata";
export { generateProductionSitemapXml, productionSitemapPathnames } from "./features/learning/seo/learningSitemap";
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

export const stableLearningRoutes = [
  ...stableLearningPathnames,
].map((pathname) => ({ pathname, metadata: learningRouteMetadata(pathname) }));

export const stableBookRoutes = [...stableBookPathnames].map((pathname) => ({ pathname, metadata: bookRouteMetadata(pathname) }));

export function renderLearningRoute(pathname: string) {
  return renderToString(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={[pathname]}>
        <Routes>
          <Route path="/hoc" element={<LearningHubPage />} />
          <Route path="/hoc/:levelSlug" element={<LearningLevelPage />} />
          <Route path="/hoc/:levelSlug/:unitSlug" element={<LearningUnitPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

export function renderLearningHubPage() { return renderLearningRoute("/hoc"); }

export function renderBookRoute(pathname: string) {
  return renderToString(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={[pathname]}>
        <Routes>
          <Route path="/sach" element={<BookLibraryPage />} />
          <Route path="/sach/:seriesSlug/:bookSlug" element={<BookPreviewPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}
