import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppLayout } from "./components/Layout";
import { SessionProvider, UiProvider, useSession } from "./lib/session";
import { Admin } from "./pages/Admin";
import { AuthPage } from "./pages/AuthPage";
import { Home } from "./pages/Home";
import { Leaderboard } from "./pages/Leaderboard";
import { Notifications } from "./pages/Notifications";
import { Onboarding } from "./pages/Onboarding";
import { AvatarPage, Settings } from "./pages/Settings";
import { UserProfile } from "./pages/UserProfile";
import { WeighIn } from "./pages/WeighIn";

function Gate() {
  const { me, loading } = useSession();
  if (loading) return <div className="spinner" style={{ marginTop: "40vh" }} />;
  if (!me) return <AuthPage />;
  if (!me.onboarded) return <Onboarding />;
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="classifica" element={<Leaderboard />} />
        <Route path="pesata" element={<WeighIn />} />
        <Route path="notifiche" element={<Notifications />} />
        <Route path="profilo" element={<Settings />} />
        <Route path="avatar" element={<AvatarPage />} />
        <Route path="utente/:id" element={<UserProfile />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <UiProvider>
        <SessionProvider>
          <Gate />
        </SessionProvider>
      </UiProvider>
    </BrowserRouter>
  );
}
