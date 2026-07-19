"use client";

import { useRef, useState } from "react";
import { UserDto } from "@queuehub/shared";
import { apiRequest, ApiError, apiUrl } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";

export function AvatarUploader({ user, onUpdated }: { user: UserDto; onUpdated: (u: UserDto) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);

  function initials() {
    return `${user.firstName[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
  }

  async function uploadBlob(blob: Blob, filename: string) {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", blob, filename);
      const res = await fetch(apiUrl("/profile/avatar"), {
        method: "PATCH",
        credentials: "include",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Не удалось загрузить фото");
      }
      const updated: UserDto = await res.json();
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить фото");
    } finally {
      setBusy(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadBlob(file, file.name);
    e.target.value = "";
  }

  async function openCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      setError("Не удалось получить доступ к камере");
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (blob) {
        await uploadBlob(blob, "camera.png");
      }
      closeCamera();
    }, "image/png");
  }

  async function removeAvatar() {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiRequest<UserDto>("/profile/avatar", { method: "DELETE" });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось удалить фото");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="Аватар" className="h-24 w-24 rounded-full object-cover" />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-100 text-2xl font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
          {initials()}
        </div>
      )}

      {cameraOpen ? (
        <div className="flex flex-col items-center gap-2">
          <video ref={videoRef} autoPlay playsInline className="h-48 w-64 rounded-lg bg-black object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={capturePhoto} disabled={busy}>
              Снять фото
            </button>
            <button type="button" className="btn-secondary" onClick={closeCamera}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-secondary" onClick={openCamera} disabled={busy}>
            Сделать фото с камеры
          </button>
          <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={busy}>
            Выбрать из галереи/файла
          </button>
          {user.avatarUrl && (
            <button type="button" className="btn-danger" onClick={removeAvatar} disabled={busy}>
              Удалить фото
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
