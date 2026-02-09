import multer from "multer";
import type { Request } from "express";
import { uploadFile } from "./objectStorage";

const storage = multer.memoryStorage();

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for long audio recordings
  },
});

export async function handleFileUpload(
  file: Express.Multer.File,
  directory: "equipment" | "work-orders" | "manuals" | "training"
): Promise<string> {
  if (!file) {
    throw new Error("No file provided");
  }

  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    throw new Error("Object storage not configured");
  }

  const timestamp = Date.now();
  const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `public/${directory}/${timestamp}-${sanitized}`;

  const url = await uploadFile(
    bucketId,
    fileName,
    file.buffer,
    file.mimetype
  );

  return url;
}
