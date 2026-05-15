import { parseStl } from "./stl-parser";
import { quaternionToMatrix3, type Quaternion } from "./stl-transform";

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

// Computes the axis-aligned bounding box after rotating the part by the given quaternion.
// Uses the exact AABB formula for rotated boxes: new_half_extent[d] = sum(|R[d][i]| * old_half[i]).
export function applyQuaternionToBbox(bbox: Bbox, q: Quaternion): Bbox {
  const m = quaternionToMatrix3(q);
  const hx = bbox.x / 2, hy = bbox.y / 2, hz = bbox.z / 2;
  return {
    x: Math.round((Math.abs(m[0]) * hx + Math.abs(m[1]) * hy + Math.abs(m[2]) * hz) * 2),
    y: Math.round((Math.abs(m[3]) * hx + Math.abs(m[4]) * hy + Math.abs(m[5]) * hz) * 2),
    z: Math.round((Math.abs(m[6]) * hx + Math.abs(m[7]) * hy + Math.abs(m[8]) * hz) * 2),
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
