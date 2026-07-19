"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Role } from "@queuehub/shared";
import { useAuthStore } from "@/lib/auth-store";
import { useThemeStore } from "@/lib/theme-store";
import { apiRequest } from "@/lib/api-client";

export function Navbar() {
  const { user, clearSession } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const router = useRouter();

  async function handleLogout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    clearSession();
    router.push("/");
  }

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-brand-600 dark:text-brand-400">
          QueueHub
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          {user && (user.role === Role.TEACHER || user.role === Role.ADMIN) && (
            <Link href="/teacher" className="hover:text-brand-600 dark:hover:text-brand-400">
              Мои очереди
            </Link>
          )}
          {user && !user.isGuest && (
            <Link href="/profile" className="hover:text-brand-600 dark:hover:text-brand-400">
              Профиль
            </Link>
          )}

          <button
            type="button"
            onClick={toggle}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
            aria-label="Переключить тему"
          >
            {theme === "dark" ? "☀️ Светлая" : "🌙 Тёмная"}
          </button>

          {user ? (
            <button type="button" onClick={handleLogout} className="btn-secondary">
              Выйти
            </button>
          ) : (
            <>
              <Link href="/login" className="btn-secondary">
                Войти
              </Link>
              <Link href="/register" className="btn-primary">
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
