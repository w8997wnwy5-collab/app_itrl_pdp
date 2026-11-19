import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Me } from "../../../shared/types";
import { api, ApiError, errorMessage } from "./api";

interface SessionValue {
  me: Me | null;
  loading: boolean;
  setMe: (me: Me | null) => void;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const { me } = await api.get<{ me: Me | null }>("/auth/session");
      setMe(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
    const onUnauthorized = () => setMe(null);
    window.addEventListener("cpv:unauthorized", onUnauthorized);
    return () => window.removeEventListener("cpv:unauthorized", onUnauthorized);
  }, [refreshMe]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => undefined);
    setMe(null);
  }, []);

  return (
    <SessionContext.Provider value={{ me, loading, setMe, refreshMe, logout }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside SessionProvider");
  return ctx;
}

/** The logged-in user (only use inside authenticated routes). */
export function useMe(): Me {
  const { me } = useSession();
  if (!me) throw new Error("Not logged in");
  return me;
}

interface Toast {
  id: number;
  text: string;
  kind: "info" | "error";
}

interface UiValue {
  toast: (text: string, kind?: "info" | "error") => void;
  celebrate: () => void;
}

const UiContext = createContext<UiValue | null>(null);

const CONFETTI_COLORS = ["#6d4aff", "#ffc933", "#ff5fa2", "#3ccb73", "#3b82f6", "#f27b2f"];

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confetti, setConfetti] = useState<number | null>(null);
  const nextId = useRef(1);

  const toast = useCallback((text: string, kind: "info" | "error" = "info") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 4500 : 3200);
  }, []);

  const celebrate = useCallback(() => {
    setConfetti(Date.now());
    setTimeout(() => setConfetti(null), 3200);
  }, []);

  return (
    <UiContext.Provider value={{ toast, celebrate }}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.kind === "error" ? " error" : ""}`} role={t.kind === "error" ? "alert" : "status"}>
            {t.text}
          </div>
        ))}
      </div>
      {confetti ? (
        <div className="confetti" aria-hidden="true" key={confetti}>
          {Array.from({ length: 70 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDuration: `${1.8 + ((i * 13) % 12) / 10}s`,
                animationDelay: `${((i * 7) % 10) / 20}s`,
                transform: `rotate(${(i * 47) % 360}deg)`,
              }}
            />
          ))}
        </div>
      ) : null}
    </UiContext.Provider>
  );
}

export function useUi(): UiValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi outside UiProvider");
  return ctx;
}

/** Fetches a GET endpoint; keeps previous data while reloading. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<T>(path)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, reload, setData };
}
