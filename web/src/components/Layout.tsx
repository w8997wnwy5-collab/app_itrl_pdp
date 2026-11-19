import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { api } from "../lib/api";

export function useUnreadCount(): number {
  const [count, setCount] = useState(0);
  const location = useLocation();
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .get<{ unreadCount: number }>("/notifications")
        .then((r) => !cancelled && setCount(r.unreadCount))
        .catch(() => undefined);
    void load();
    const t = setInterval(load, 60_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("cpv:notifications", onFocus);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("cpv:notifications", onFocus);
    };
  }, [location.pathname]);
  return count;
}

export function AppLayout() {
  const unread = useUnreadCount();
  return (
    <div className="app">
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Navigazione principale">
        <NavLink to="/" end>
          <span className="tab-ico" aria-hidden="true">
            🏠
          </span>
          Home
        </NavLink>
        <NavLink to="/classifica">
          <span className="tab-ico" aria-hidden="true">
            🏆
          </span>
          Classifica
        </NavLink>
        <NavLink to="/pesata" className="tab-center">
          <span className="tab-ico" aria-hidden="true">
            ⚖️
          </span>
          Pesata
        </NavLink>
        <NavLink to="/notifiche">
          <span className="tab-ico" aria-hidden="true">
            🔔
          </span>
          Notifiche
          {unread > 0 ? <span className="dot-count">{unread > 99 ? "99+" : unread}</span> : null}
        </NavLink>
        <NavLink to="/profilo">
          <span className="tab-ico" aria-hidden="true">
            🙂
          </span>
          Profilo
        </NavLink>
      </nav>
    </div>
  );
}

export function TopBar({ title, subtitle, back, right }: { title: ReactNode; subtitle?: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <header className="topbar">
      {back ? (
        <Link to={back} className="icon-btn" aria-label="Indietro">
          ←
        </Link>
      ) : null}
      <div className="topbar__title">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {right}
    </header>
  );
}
