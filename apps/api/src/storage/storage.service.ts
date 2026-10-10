import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

@Injectable()
export class StorageService {
  private client: SupabaseClient | null = null;

  private getClient(): SupabaseClient {
    if (this.client) return this.client;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new InternalServerErrorException(
        "Хранилище файлов не настроено: заданы не все переменные SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    this.client = createClient(url, key);
    return this.client;
  }

  private bucket(): string {
    return process.env.SUPABASE_AVATAR_BUCKET ?? "avatars";
  }

  private localDirectory(): string {
    return join(process.cwd(), "uploads", "avatars");
  }

  private hasSupabaseConfig(): boolean {
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    return Boolean(
      url &&
        key &&
        !url.includes("your-project.supabase.co") &&
        !key.includes("your-service-role-key"),
    );
  }

  async uploadAvatar(userId: string, buffer: Buffer, contentType: string, extension: string) {
    const bucket = this.bucket();
    const filename = `${randomUUID()}.${extension}`;

    if (this.hasSupabaseConfig()) {
      const path = `${userId}/${filename}`;
      const { error } = await this.getClient()
        .storage.from(bucket)
        .upload(path, buffer, { contentType, upsert: true });

      if (error) {
        throw new InternalServerErrorException(`Не удалось загрузить фото: ${error.message}`);
      }

      const { data } = this.getClient().storage.from(bucket).getPublicUrl(path);
      return { path, publicUrl: data.publicUrl };
    }

    if (process.env.NODE_ENV === "production") {
      throw new InternalServerErrorException(
        "Хранилище фото не настроено: задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY",
      );
    }

    await mkdir(this.localDirectory(), { recursive: true });
    await writeFile(join(this.localDirectory(), filename), buffer);
    const apiUrl =
      process.env.API_PUBLIC_URL ??
      `http://localhost:${process.env.PORT ?? process.env.API_PORT ?? 4000}`;
    return {
      path: filename,
      publicUrl: `${apiUrl.replace(/\/$/, "")}/uploads/avatars/${filename}`,
    };
  }

  async removeAvatarByUrl(publicUrl: string | null) {
    if (!publicUrl) return;
    const localMarker = "/uploads/avatars/";
    const localIndex = publicUrl.indexOf(localMarker);
    if (localIndex !== -1) {
      const filename = basename(publicUrl.slice(localIndex + localMarker.length));
      try {
        await unlink(join(this.localDirectory(), filename));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
      return;
    }

    const bucket = this.bucket();
    const marker = `/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const path = publicUrl.slice(idx + marker.length);
    if (!path) return;
    const { error } = await this.getClient().storage.from(bucket).remove([path]);
    if (error) {
      throw new InternalServerErrorException(`Не удалось удалить старое фото: ${error.message}`);
    }
  }
}
