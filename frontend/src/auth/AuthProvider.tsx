import * as React from "react";
import { api } from "../api/client";
import { setUnauthorizedHandler } from "../api/runtime";

export type Me = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  groups: string[];
  permissions: string[];
  profile?: {
    avatar: string | null;
    preferred_customer: number | null;
    preferred_customer_name?: string | null;
  };
};

type AuthCtx = {
  me: Me | null;
  loading: boolean;
  refreshMe: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPerm: (perm: string) => boolean;
  inGroup: (group: string) => boolean;
};

const AuthContext = React.createContext<AuthCtx | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = React.useState<Me | null>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    setUnauthorizedHandler(() => {
      setMe(null);
      window.location.assign("/login");
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  const refreshMe = React.useCallback(async () => {
    try {
      const res = await api.get<Me>("/me/");
      setMe(res.data);
    } catch {
      setMe(null);
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Set csrftoken cookie
        await api.get("/auth/csrf/");
        await refreshMe();
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshMe]);

  const login = React.useCallback(
    async (username: string, password: string) => {
      // Assicura csrftoken prima del POST
      await api.get("/auth/csrf/");
      await api.post("/auth/login/", { username, password });
      await refreshMe();
    },
    [refreshMe]
  );

  const logout = React.useCallback(async () => {
    try {
      await api.post("/auth/logout/");
    } finally {
      setMe(null);
    }
  }, []);

  const hasPerm = React.useCallback(
    (perm: string) => Boolean(me?.is_superuser || (me?.permissions || []).includes(perm)),
    [me]
  );

  const inGroup = React.useCallback(
    (group: string) => Boolean(me?.is_superuser || (me?.groups || []).includes(group)),
    [me]
  );

  return (
    <AuthContext.Provider value={{ me, loading, refreshMe, login, logout, hasPerm, inGroup }}>
      {children}
    </AuthContext.Provider>
  );
}
