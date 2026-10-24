import { useEffect, useState } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { Shell } from "./app/Shell";
import { DemoProvider } from "./app/DemoContext";
import { PosCartProvider } from "./app/PosCartContext";
import { seedIfEmpty } from "./db/repo";
import { OwnerOverview } from "./pages/OwnerOverview";
import { Purchasing } from "./pages/Purchasing";
import { Pos } from "./pages/Pos";
import { StockCountPage } from "./pages/StockCountPage";
import { Approvals } from "./pages/Approvals";
import { Till } from "./pages/Till";
import { Products } from "./pages/Products";
import { Activity } from "./pages/Activity";
import { Demo } from "./pages/Demo";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: "overview", element: <OwnerOverview /> },
      { path: "purchasing", element: <Purchasing /> },
      { path: "pos", element: <Pos /> },
      { path: "stock-count", element: <StockCountPage /> },
      { path: "approvals", element: <Approvals /> },
      { path: "till", element: <Till /> },
      { path: "products", element: <Products /> },
      { path: "activity", element: <Activity /> },
      { path: "demo", element: <Demo /> },
      { path: "*", element: <Navigate to="/overview" replace /> },
    ],
  },
]);

function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    seedIfEmpty()
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to initialize demo data."));
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--color-surface)] p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-[var(--color-danger-600)]">Could not initialize the demo database</p>
          <p className="mt-1 text-xs text-[var(--color-ink-500)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--color-surface)]">
        <p className="text-sm text-[var(--color-ink-500)]">Preparing demonstration business…</p>
      </div>
    );
  }

  return (
    <DemoProvider>
      <PosCartProvider>
        <RouterProvider router={router} />
      </PosCartProvider>
    </DemoProvider>
  );
}

export default App;
