import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const Splash = () => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-aurora">
    <Loader2 className="h-8 w-8 animate-spin text-gold" />
  </div>
);

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
};

export const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to="/home" replace />;
  return <>{children}</>;
};
