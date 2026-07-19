"use client";

import { useAuthStore } from "./auth-store";
import { apiUrl } from "./api-client";

export async function downloadFile(path: string, filename: string) {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(apiUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Не удалось скачать файл");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
