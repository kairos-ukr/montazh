import React, { createContext, useContext, useState, useEffect } from "react";
import { apiGet, apiPost } from "../api/http"; // Використовуємо наш правильний http клієнт

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Функція завантаження сесії
  const checkAuth = async () => {
    try {
      // apiGet вже має credentials: "include", тому кука полетить на сервер
      const data = await apiGet("/api/auth/me");
      
      setUser(data.user);
      setEmployee(data.employee);
    } catch (err) {
      console.log("Not authenticated", err);
      setUser(null);
      setEmployee(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const signIn = async (email, password) => {
    // Тут ми просто робимо запит, а перенаправлення робить форма (AuthPage)
    await apiPost("/api/auth/sign-in", { email, password });
    // Після успішного входу оновлюємо дані користувача
    await checkAuth();
  };

  const signOut = async () => {
    try {
      await apiPost("/api/auth/sign-out");
    } finally {
      setUser(null);
      setEmployee(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, employee, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}