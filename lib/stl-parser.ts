export interface ParsedMesh {
  vertices: number[]; // flat [x,y,z, x,y,z, ...]
  triangles: number[]; // flat [v0,v1,v2, v0,v1,v2, ...]
}

function isBinaryStl(buffer: Buffer): boolean {
  if (buffer.length < 84) return false;
  const triangleCount = buffer.readUInt32LE(80);
  return buffer.length === 84 + triangleCount * 50;
}

function parseBinaryStl(buffer: Buffer): ParsedMesh {
  const triangleCount = buffer.readUInt32LE(80);
  const vertices: number[] = [];
  const triangles: number[] = [];
  const indexMap = new Map<string, number>();

  function getIndex(x: number, y: number, z: number): number {
    const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
    const existing = indexMap.get(key);
    if (existing !== undefined) return existing;
    const idx = vertices.length / 3;
    vertices.push(x, y, z);
    indexMap.set(key, idx);
    return idx;
  }

  for (let i = 0; i < triangleCount; i++) {
    const offset = 84 + i * 50;
    // Skip normal (12 bytes), read 3 vertices
    for (let v = 0; v < 3; v++) {
      const vOffset = offset + 12 + v * 12;
      const x = buffer.readFloatLE(vOffset);
      const y = buffer.readFloatLE(vOffset + 4);
      const z = buffer.readFloatLE(vOffset + 8);
      triangles.push(getIndex(x, y, z));
    }
  }

  return { vertices, triangles };
}

function parseAsciiStl(buffer: Buffer): ParsedMesh {
  const text = buffer.toString("utf8");
  const vertices: number[] = [];
  const triangles: number[] = [];
  const indexMap = new Map<string, number>();

  function getIndex(x: number, y: number, z: number): number {
    const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
    const existing = indexMap.get(key);
    if (existing !== undefined) return existing;
    const idx = vertices.length / 3;
    vertices.push(x, y, z);
    indexMap.set(key, idx);
    return idx;
  }

  const vertexRegex = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g;
  let match: RegExpExecArray | null;
  let facetVertices: number[] = [];

  while ((match = vertexRegex.exec(text)) !== null) {
    facetVertices.push(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]));
    if (facetVertices.length === 9) {
      for (let v = 0; v < 3; v++) {
        triangles.push(getIndex(facetVertices[v * 3], facetVertices[v * 3 + 1], facetVertices[v * 3 + 2]));
      }
      facetVertices = [];
    }
  }

  return { vertices, triangles };
}

export function parseStl(buffer: Buffer): ParsedMesh {
  if (isBinaryStl(buffer)) {
    return parseBinaryStl(buffer);
  }
  return parseAsciiStl(buffer);
}
