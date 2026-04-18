export type FileCategory = "REFERENCE" | "DESIGN" | "RESULT" | "OTHER";
export type FileSource = "CUSTOMER" | "TEAM";

export interface OrderFileData {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  source: FileSource;
  category: FileCategory;
  orderPartId: string | null;
  createdAt: string;
}

export const CATEGORY_LABELS: Record<FileCategory, string> = {
  REFERENCE: "Referenz",
  DESIGN: "Design",
  RESULT: "Druckergebnis",
  OTHER: "Sonstiges",
};

export const CATEGORY_COLORS: Record<FileCategory, string> = {
  DESIGN: "bg-blue-100 text-blue-700",
  REFERENCE: "bg-gray-100 text-gray-600",
  RESULT: "bg-green-100 text-green-700",
  OTHER: "bg-yellow-100 text-yellow-700",
};

export const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.gif,.webp,.stl,.obj,.3mf";
