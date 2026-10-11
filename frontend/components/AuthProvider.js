"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api, refresh, setToken } from "@/lib/api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

 
  useEffect(() => {
    let alive = true;
    refresh().then((d) => {
      if (!alive) return;
      setUser(d && d.user ? d.user : null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  async function authenticate(path, body) {
    const d = await api(path, { method: "POST", body });
    setToken(d.accessToken);
    setUser(d.user);
  }
  const login = (email, password) => authenticate("/auth/login", { email, password });
  const signup = (name, email, password) => authenticate("/auth/signup", { name, email, password });
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setToken(null);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, login, signup, logout }}>{children}</Ctx.Provider>;
}
