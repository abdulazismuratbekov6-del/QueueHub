"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserDto } from "@queuehub/shared";

interface AuthState {
  accessToken: string | null;
  csrfToken: string | null;
  user: UserDto | null;
  setSession: (data: { accessToken: string; csrfToken?: string | null; user: UserDto }) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      csrfToken: null,
      user: null,
      setSession: ({ accessToken, csrfToken, user }) =>
        set((state) => ({
          accessToken,
          csrfToken: csrfToken !== undefined ? csrfToken : state.csrfToken,
          user,
        })),
      clearSession: () => set({ accessToken: null, csrfToken: null, user: null }),
    }),
    { name: "queuehub-auth" },
  ),
);
