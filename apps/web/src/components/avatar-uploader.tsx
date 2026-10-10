"use client";

import { useEffect, useRef, useState } from "react";
import { UserDto } from "@queuehub/shared";
import { apiRequest, ApiError } from "@/lib/api-client";

export function AvatarUploader({ user, onUpdated }: { user: UserDto; onUpdated: (u: UserDto) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOpen || !video || !stream) return;

    video.srcObject = stream;
    void video.play().catch(() => {
      setError("Не удалось запустить видео. Проверьте разрешение браузера на использование камеры.");
    });
  }, [cameraOpen]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  function initials() {
    return `${user.firstName[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
  }

  async function uploadBlob(blob: Blob, filename: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", blob, filename);
      const updated = await apiRequest<UserDto>("/profile/avatar", {
        method: "PATCH",
        body: formData,
      });
      onUpdated(updated);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить фото");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Выберите изображение PNG, JPEG или WEBP.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Размер фотографии не должен превышать 5 МБ.");
      e.target.value = "";
      return;
    }

    await uploadBlob(file, file.name);
    e.target.value = "";
  }

  async function openCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Камера недоступна. Откройте сайт через localhost или HTTPS.");
      return;
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      setCameraOpen(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Разрешите доступ к камере в настройках браузера и попробуйте снова.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("Камера не найдена.");
      } else {
        setError("Не удалось открыть камеру. Проверьте, что её не использует другое приложение.");
      }
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (!video.videoWidth || !video.videoHeight) {
      setError("Камера ещё не готова. Подождите немного и попробуйте снова.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Не удалось обработать снимок.");
      return;
    }
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      setError("Не удалось создать файл фотографии.");
      return;
    }
    if (await uploadBlob(blob, "camera.png")) closeCamera();
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
            <button type="button" className="btn-primary" onClick={() => void capturePhoto()} disabled={busy}>
              Снять фото
            </button>
            <button type="button" className="btn-secondary" onClick={closeCamera}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => void openCamera()} disabled={busy}>
            Сделать фото с камеры
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            Выбрать из галереи/файла
          </button>
          {user.avatarUrl && (
            <button type="button" className="btn-danger" onClick={() => void removeAvatar()} disabled={busy}>
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
