import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import crypto from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateTrackingToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MODEL_EXTENSIONS = new Set(["stl", "obj", "3mf"]);

export function is3DModel(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MODEL_EXTENSIONS.has(ext);
}

export function get3DExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}
