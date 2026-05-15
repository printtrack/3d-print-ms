import { parseStl } from "./stl-parser";

export interface Quaternion {
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

export function isIdentityQuaternion(q: Quaternion): boolean {
  return Math.abs(q.qx) < 1e-9 && Math.abs(q.qy) < 1e-9 && Math.abs(q.qz) < 1e-9 && Math.abs(q.qw - 1) < 1e-9;
}

// Converts quaternion to a column-major 3×3 rotation matrix (row-major storage as flat 9-element array)
export function quaternionToMatrix3(q: Quaternion): number[] {
  const { qx: x, qy: y, qz: z, qw: w } = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  return [
    1 - (yy + zz), xy + wz,       xz - wy,
    xy - wz,       1 - (xx + zz), yz + wx,
    xz + wy,       yz - wx,       1 - (xx + yy),
  ];
}

// Rotates every vertex in a binary STL buffer by the given quaternion.
// Returns the original buffer unchanged when q is the identity rotation.
export function rotateStlBuffer(buffer: Buffer, q: Quaternion): Buffer {
  if (isIdentityQuaternion(q)) return buffer;

  const m = quaternionToMatrix3(q);
  const { vertices, triangles } = parseStl(buffer);

  // Rotate all vertices: v' = R * v (row-major R: m[row*3+col])
  const rotated = new Float32Array(vertices.length);
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
    rotated[i]     = m[0] * x + m[1] * y + m[2] * z;
    rotated[i + 1] = m[3] * x + m[4] * y + m[5] * z;
    rotated[i + 2] = m[6] * x + m[7] * y + m[8] * z;
  }

  // Write binary STL
  const triangleCount = triangles.length / 3;
  const out = Buffer.alloc(84 + triangleCount * 50);
  // Header: 80 bytes zeros
  out.writeUInt32LE(triangleCount, 80);

  for (let i = 0; i < triangleCount; i++) {
    const off = 84 + i * 50;
    const vi = [triangles[i * 3], triangles[i * 3 + 1], triangles[i * 3 + 2]];
    const vx = vi.map(v => [rotated[v * 3], rotated[v * 3 + 1], rotated[v * 3 + 2]]);

    // Compute face normal from rotated vertices
    const ax = vx[1][0] - vx[0][0], ay = vx[1][1] - vx[0][1], az = vx[1][2] - vx[0][2];
    const bx = vx[2][0] - vx[0][0], by = vx[2][1] - vx[0][1], bz = vx[2][2] - vx[0][2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

    out.writeFloatLE(nx / nl, off);
    out.writeFloatLE(ny / nl, off + 4);
    out.writeFloatLE(nz / nl, off + 8);

    for (let v = 0; v < 3; v++) {
      out.writeFloatLE(vx[v][0], off + 12 + v * 12);
      out.writeFloatLE(vx[v][1], off + 12 + v * 12 + 4);
      out.writeFloatLE(vx[v][2], off + 12 + v * 12 + 8);
    }
    // Attribute byte count = 0 (already zero from alloc)
  }

  return out;
}
