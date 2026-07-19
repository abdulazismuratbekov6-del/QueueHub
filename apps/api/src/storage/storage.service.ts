import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

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

  async uploadAvatar(userId: string, buffer: Buffer, contentType: string, extension: string) {
    const bucket = this.bucket();
    const path = `${userId}/${randomUUID()}.${extension}`;

    const { error } = await this.getClient()
      .storage.from(bucket)
      .upload(path, buffer, { contentType, upsert: true });

    if (error) {
      throw new InternalServerErrorException(`Не удалось загрузить фото: ${error.message}`);
    }

    const { data } = this.getClient().storage.from(bucket).getPublicUrl(path);
    return { path, publicUrl: data.publicUrl };
  }

  async removeAvatarByUrl(publicUrl: string | null) {
    if (!publicUrl) return;
    const bucket = this.bucket();
    const marker = `/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const path = publicUrl.slice(idx + marker.length);
    if (!path) return;
    await this.getClient().storage.from(bucket).remove([path]);
  }
}
