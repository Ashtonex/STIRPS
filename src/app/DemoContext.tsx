import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DemoRole } from "../domain/types";

const ROLE_PERSONA: Record<DemoRole, string> = {
  owner: "Mr. Moyo (Owner)",
  manager: "Farai (Manager)",
  cashier: "Chipo (Cashier)",
  storekeeper: "Tendai (Storekeeper)",
};

const STORAGE_KEY = "stirps.demoRole";

interface DemoContextValue {
  role: DemoRole;
  actor: string;
  setRole: (role: DemoRole) => void;
  online: boolean;
}

const DemoContext = createContext<DemoContextValue | null>(null);

function readStoredRole(): DemoRole {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "owner" || raw === "manager" || raw === "cashier" || raw === "storekeeper") return raw;
  } catch {
    // ignore - private browsing / blocked storage
  }
  return "owner";
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<DemoRole>(() => readStoredRole());
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const setRole = (next: DemoRole) => {
    setRoleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const value = useMemo<DemoContextValue>(
    () => ({ role, actor: ROLE_PERSONA[role], setRole, online }),
    [role, online],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}

export const ROLE_LABELS: Record<DemoRole, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  storekeeper: "Storekeeper",
};
