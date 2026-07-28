import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_BASE } from "../config/api";
import { getCsrfToken } from "../utils/csrf";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refrescar = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me/`, { credentials: "include" });
      const data = await res.json();
      setUser(res.ok ? data.usuario : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refrescar(); }, [refrescar]);

  const login = async (username, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    const resultado = await res.json();
    if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo iniciar sesión");
    setUser(resultado.usuario);
    return resultado.usuario;
  };

  const logout = async () => {
    await fetch(`${API_BASE}/api/auth/logout/`, {
      method: "POST",
      headers: { "X-CSRFToken": getCsrfToken() },
      credentials: "include",
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
