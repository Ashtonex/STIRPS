import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDemo, ROLE_LABELS } from "./DemoContext";
import type { DemoRole } from "../domain/types";

const NAV_ITEMS = [
  { to: "/overview", label: "Owner Overview", icon: "📊" },
  { to: "/purchasing", label: "Purchasing", icon: "📦" },
  { to: "/pos", label: "Point of Sale", icon: "🛒" },
  { to: "/stock-count", label: "Stock Count", icon: "📋" },
  { to: "/approvals", label: "Approvals", icon: "✅" },
  { to: "/till", label: "Till", icon: "💷" },
  { to: "/products", label: "Products & Inventory", icon: "🏷️" },
  { to: "/activity", label: "Activity History", icon: "🕒" },
];

export function Shell() {
  const { role, setRole, online } = useDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  // Close the mobile nav drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-full w-full bg-[var(--color-surface)] text-[var(--color-ink-900)]">
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-[var(--color-navy-950)] text-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-crimson-600)] font-bold text-white">
            S
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">STIRPS</div>
            <div className="text-[11px] leading-tight text-white/50">by Flectēre</div>
          </div>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
            className="ml-auto rounded p-1 text-white/70 hover:bg-white/10 lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="scroll-region flex-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive ? "bg-[var(--color-crimson-600)] text-white font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <span aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <NavLink
            to="/demo"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive ? "bg-white/15 text-white font-medium" : "text-white/60 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <span aria-hidden>🎬</span>
            <span>Demo Controls</span>
          </NavLink>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
              className="shrink-0 rounded-md border border-[var(--color-border)] p-2 text-[var(--color-ink-700)] lg:hidden"
            >
              ☰
            </button>
            <span className="truncate rounded-full bg-[var(--color-navy-800)] px-3 py-1 text-xs font-medium text-white">
              Harare Grocers &amp; Wholesale
            </span>
            <span className="hidden shrink-0 text-xs text-[var(--color-ink-500)] md:inline">Main Branch · Till 1</span>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-1.5 text-xs text-[var(--color-ink-500)] sm:flex">
              <span className={`inline-block h-2 w-2 rounded-full ${online ? "bg-[var(--color-success-600)]" : "bg-[var(--color-danger-600)]"}`} />
              {online ? "Local demo — online" : "Offline"}
            </div>

            <label className="flex items-center gap-1.5 text-xs text-[var(--color-ink-700)] sm:gap-2">
              <span className="hidden sm:inline">Acting as</span>
              <select
                className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1.5 text-sm font-medium text-[var(--color-ink-900)]"
                value={role}
                onChange={(e) => setRole(e.target.value as DemoRole)}
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => navigate("/demo")}
              className="rounded-md bg-[var(--color-navy-900)] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-navy-800)] sm:px-3"
            >
              <span className="sm:hidden">Reset</span>
              <span className="hidden sm:inline">Reset / Walkthrough</span>
            </button>
          </div>
        </header>

        <main className="scroll-region min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
