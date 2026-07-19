"use client";

import { useAuthStore } from "./auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipAuth?: boolean;
}

async function refreshSession(): Promise<boolean> {
  const { csrfToken, setSession } = useAuthStore.getState();
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
  });
  if (!res.ok) return false;
  const data = await res.json();
  setSession({ accessToken: data.accessToken, csrfToken: data.csrfToken, user: data.user });
  return true;
}

async function rawRequest(path: string, options: RequestOptions, token: string | null) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token && !options.skipAuth ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: isFormData ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
  });
}

export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  let res = await rawRequest(path, options, token);

  if (res.status === 401 && !options.skipAuth) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const newToken = useAuthStore.getState().accessToken;
      res = await rawRequest(path, options, newToken);
    }
  }

  if (!res.ok) {
    let message = `Ошибка запроса (${res.status})`;
    try {
      const body = await res.json();
      message = body.message ?? message;
      if (Array.isArray(message)) message = message.join(", ");
    } catch {
      /* ignore parse error */
    }
    if (res.status === 401) {
      useAuthStore.getState().clearSession();
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export function apiUrl(path: string) {
  return `${API_URL}${path}`;
}
