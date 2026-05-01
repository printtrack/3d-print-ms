import { parseStl } from "./stl-parser";

export interface Bbox {
  x: number;
  y: number;
  z: number;
}

export interface PrintOrientation {
  width: number;
  depth: number;
  height: number;
}

export function computeBbox(buffer: Buffer): Bbox {
  const { vertices } = parseStl(buffer);
  if (vertices.length === 0) return { x: 0, y: 0, z: 0 };

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  return {
    x: Math.round(maxX - minX),
    y: Math.round(maxY - minY),
    z: Math.round(maxZ - minZ),
  };
}

// Returns the axis-aligned orientation with the smallest footprint (width × depth)
// where height fits within buildZ and the footprint fits within buildX × buildY
// (allowing a 90° in-plane rotation). Returns null if the part cannot fit.
export function pickPrintOrientation(
  bbox: Bbox,
  build: { x: number; y: number; z: number }
): PrintOrientation | null {
  // Three possible "lay-flat" orientations: which axis becomes the height
  const poses: PrintOrientation[] = [
    { width: bbox.x, depth: bbox.y, height: bbox.z },
    { width: bbox.x, depth: bbox.z, height: bbox.y },
    { width: bbox.y, depth: bbox.z, height: bbox.x },
  ];

  let best: PrintOrientation | null = null;

  for (const pose of poses) {
    if (pose.height > build.z) continue;

    // Check if the footprint fits (with or without a 90° in-plane rotation)
    const fitsNormal = pose.width <= build.x && pose.depth <= build.y;
    const fitsRotated = pose.depth <= build.x && pose.width <= build.y;
    if (!fitsNormal && !fitsRotated) continue;

    // Normalize so width ≤ depth (canonical smallest-footprint representation)
    const w = Math.min(pose.width, pose.depth);
    const d = Math.max(pose.width, pose.depth);
    const candidate: PrintOrientation = { width: w, depth: d, height: pose.height };

    if (best === null || w * d < best.width * best.depth) {
      best = candidate;
    }
  }

  return best;
}
