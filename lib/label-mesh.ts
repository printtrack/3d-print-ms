/**
 * Generates a manifold 3D label mesh (base plate + raised letters).
 *
 * Architecture — three layers share the z=BASE_H plane without coincident faces:
 *   1. Base plate background : ShapeGeometry of base rectangle with letter-outer-boundary holes.
 *   2. TextGeometry letters  : raised from z=BASE_H → z=BASE_H+RAISE (bottom face included,
 *      covers the letter-ring area at z=BASE_H).
 *   3. Counter caps          : ShapeGeometry for each inner counter (e.g. inside 'O', 'B', 'D').
 *      Together, 1+2+3 tile the entire z=BASE_H plane without overlap.
 *
 * All edge-shared boundary points come from the same font.generateShapes() call with the
 * same curveSegments, so vertex positions are bitwise-identical → no T-junctions.
 */

import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { TTFLoader } from "three/examples/jsm/loaders/TTFLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import nodePath from "path";
import fs from "fs";
import type { ParsedMesh } from "./stl-parser";

const FONT_PATH = nodePath.join(process.cwd(), "public/fonts/JetBrainsMono-Bold.ttf");

let cachedFont: ReturnType<FontLoader["parse"]> | null = null;
function getFont() {
  if (!cachedFont) {
    const buf = fs.readFileSync(FONT_PATH);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    cachedFont = new FontLoader().parse(new TTFLoader().parse(ab));
  }
  return cachedFont;
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

function extractGeo(
  geo: THREE.BufferGeometry,
  verts: number[], tris: number[],
  dx = 0, dy = 0, dz = 0,
  flip = false,
  skipBottomCap = false  // when true, drops triangles where all 3 vertices have z≈0
): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const base = verts.length / 3;
  for (let i = 0; i < pos.count; i++)
    verts.push(pos.getX(i) + dx, pos.getY(i) + dy, pos.getZ(i) + dz);

  function tri(a: number, b: number, c: number) {
    if (skipBottomCap) {
      const z0 = pos.getZ(a), z1 = pos.getZ(b), z2 = pos.getZ(c);
      if (Math.abs(z0) < 1e-5 && Math.abs(z1) < 1e-5 && Math.abs(z2) < 1e-5) return;
    }
    flip
      ? tris.push(base + c, base + b, base + a)
      : tris.push(base + a, base + b, base + c);
  }

  if (geo.index) {
    const idx = geo.index.array;
    for (let i = 0; i < idx.length; i += 3) tri(idx[i] as number, idx[i+1] as number, idx[i+2] as number);
  } else {
    for (let i = 0; i < pos.count; i += 3) tri(i, i+1, i+2);
  }
}

// Returns true if shape's centroid falls inside any hole of any other shape in the list.
// Used to detect "nested" shapes (e.g. the slash inside the counter of a slashed zero)
// that must not be added as bgShape holes, as earcut cannot handle hole-inside-hole nesting.
function isNestedInAnyHole(shape: THREE.Shape, allShapes: THREE.Shape[]): boolean {
  const pts = shape.getPoints(4);
  if (pts.length === 0) return false;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  for (const other of allShapes) {
    if (other === shape) continue;
    for (const hole of other.holes) {
      const hp = hole.getPoints(4);
      const minX = Math.min(...hp.map(p => p.x)), maxX = Math.max(...hp.map(p => p.x));
      const minY = Math.min(...hp.map(p => p.y)), maxY = Math.max(...hp.map(p => p.y));
      if (cx > minX && cx < maxX && cy > minY && cy < maxY) return true;
    }
  }
  return false;
}

// addQuad(A,B,C,D) — two triangles with outward normals matching the quad's face direction.
function addQuad(
  verts: number[], tris: number[],
  a: [number,number,number], b: [number,number,number],
  c: [number,number,number], d: [number,number,number]
): void {
  const base = verts.length / 3;
  verts.push(...a, ...b, ...c, ...d);
  tris.push(base, base+1, base+2,  base, base+2, base+3);
}

// ─── Label constants ─────────────────────────────────────────────────────────

const FONT_SIZE   = 8;   // mm  — cap height
const RAISE       = 1.0; // mm  — letter height above base plate
const BASE_H      = 0.8; // mm  — base plate thickness
const PAD         = 2.0; // mm  — padding around text on all sides

// Must match TextGeometry's curveSegments so shared boundaries have identical vertex positions.
const CURVE_DIVS  = 8;

// ─── Main export ─────────────────────────────────────────────────────────────

export function buildLabelMesh(text: string): ParsedMesh {
  const upper = text.toUpperCase();
  const font  = getFont();
  const verts: number[] = [];
  const tris:  number[] = [];

  // ① Letter shapes — same source TextGeometry uses internally
  const shapes = font.generateShapes(upper, FONT_SIZE);

  // ② Compute tight bounding box from the same sampled points
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  function trackPt(p: THREE.Vector2) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  for (const s of shapes) {
    s.getPoints(CURVE_DIVS).forEach(trackPt);
    s.holes.forEach(h => h.getPoints(CURVE_DIVS).forEach(trackPt));
  }
  if (!isFinite(minX)) { minX = 0; maxX = 10; minY = 0; maxY = 10; }

  const dx = PAD - minX;
  const dy = PAD - minY;
  const plateW = maxX - minX + PAD * 2;
  const plateH = maxY - minY + PAD * 2;

  // ③ TextGeometry — raised letters (includes letter bottom at z=0 pre-translation)
  //    Covers the letter-ring area of z=BASE_H.
  const textGeo = new TextGeometry(upper, {
    font,
    size:          FONT_SIZE,
    depth:         RAISE,
    curveSegments: CURVE_DIVS,
    bevelEnabled:  false,
  });
  extractGeo(textGeo, verts, tris, dx, dy, BASE_H, /* flip= */ false, /* skipBottomCap= */ true);
  textGeo.dispose();

  // ④ Base plate top background — base rectangle minus letter outer boundaries.
  //    Covers the background area of z=BASE_H (outside letter footprints).
  //    IMPORTANT: shape is kept in font space (no pre-applied dx/dy) so that
  //    float32 rounding happens identically to TextGeometry — both go through
  //    Float32BufferAttribute storage and then have dx/dy added in extractGeo.
  const bgShape = new THREE.Shape();
  bgShape.moveTo(minX - PAD, minY - PAD);
  bgShape.lineTo(maxX + PAD, minY - PAD);
  bgShape.lineTo(maxX + PAD, maxY + PAD);
  bgShape.lineTo(minX - PAD, maxY + PAD);
  for (const s of shapes) {
    // Skip shapes nested inside another shape's counter (e.g. the slash of a slashed zero);
    // earcut cannot handle hole-inside-hole and produces a corrupted triangulation.
    if (!isNestedInAnyHole(s, shapes)) {
      bgShape.holes.push(new THREE.Path(s.getPoints(CURVE_DIVS)));  // font space, no pre-translation
    }
  }
  const bgGeo = new THREE.ShapeGeometry(bgShape);
  extractGeo(bgGeo, verts, tris, dx, dy, BASE_H);  // same dx/dy application as TextGeometry
  bgGeo.dispose();

  // ⑤ Counter caps — closes the void at z=BASE_H inside letter inner counters.
  //    For each counter (e.g. inside 'O', 'B'), the cap is a ShapeGeometry of the
  //    counter area with any shapes nested INSIDE that counter as holes (e.g. the
  //    slash of a slashed zero '0'). Without this, TextGeometry's side wall for the
  //    nested shape would have no matching floor triangle → open edge.
  function centroid(sh: THREE.Shape): [number, number] {
    const p = sh.getPoints(4);
    return [p.reduce((a,v)=>a+v.x,0)/p.length, p.reduce((a,v)=>a+v.y,0)/p.length];
  }
  for (const s of shapes) {
    for (const hole of s.holes) {
      const holePts = hole.getPoints(CURVE_DIVS);
      const hMinX = Math.min(...holePts.map(p=>p.x)), hMaxX = Math.max(...holePts.map(p=>p.x));
      const hMinY = Math.min(...holePts.map(p=>p.y)), hMaxY = Math.max(...holePts.map(p=>p.y));
      const capShape = new THREE.Shape(holePts);
      // Shapes nested inside this counter (centroid inside hole bbox) become holes in the cap
      for (const other of shapes) {
        if (other === s) continue;
        const [cx, cy] = centroid(other);
        if (cx > hMinX && cx < hMaxX && cy > hMinY && cy < hMaxY) {
          capShape.holes.push(new THREE.Path(other.getPoints(CURVE_DIVS)));
        }
      }
      const capGeo = new THREE.ShapeGeometry(capShape);
      extractGeo(capGeo, verts, tris, dx, dy, BASE_H);
      capGeo.dispose();
    }
  }

  // ⑥ Base plate bottom face (faces −Z, so winding is flipped)
  const botGeo = new THREE.ShapeGeometry(new THREE.Shape([
    new THREE.Vector2(0, 0), new THREE.Vector2(0, plateH),
    new THREE.Vector2(plateW, plateH), new THREE.Vector2(plateW, 0),
  ]));
  extractGeo(botGeo, verts, tris, 0, 0, 0, /* flip= */ true);
  botGeo.dispose();

  // ⑦ Base plate side walls
  addQuad(verts, tris, [0,0,0],      [plateW,0,0],      [plateW,0,BASE_H],      [0,0,BASE_H]);       // front  −Y
  addQuad(verts, tris, [0,plateH,0], [0,plateH,BASE_H], [plateW,plateH,BASE_H], [plateW,plateH,0]);   // back   +Y
  addQuad(verts, tris, [0,0,0],      [0,0,BASE_H],      [0,plateH,BASE_H],      [0,plateH,0]);        // left   −X
  addQuad(verts, tris, [plateW,0,0], [plateW,plateH,0], [plateW,plateH,BASE_H], [plateW,0,BASE_H]);   // right  +X

  // ─── Post-processing ────────────────────────────────────────────────────────

  // Step 1: weld vertices within 1e-3 mm — fixes Float32 plate-boundary drift.
  const rawGeo = new THREE.BufferGeometry();
  rawGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  rawGeo.setIndex(tris);
  const welded = mergeVertices(rawGeo, 1e-3);
  rawGeo.dispose();

  // Step 2: T-junction repair.
  // earcut's hole-bridging can produce a bridge edge that passes through vertices
  // from OTHER hole boundaries (e.g. bridge [x0→x3] passes through x1 and x2 of
  // adjacent letter holes). These T-junctions cause open edges when TextGeometry's
  // side-wall uses [x0,x1], [x1,x2], [x2,x3] while bgShape has [x0,x3].
  // Fix: for each open edge, find collinear T-junction vertices and split the triangle.
  function repairTJunctions(geo: THREE.BufferGeometry): THREE.BufferGeometry {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const idxIn = geo.index!.array;
    const V = pos.count;

    // Build edge → triangles map
    const edgeTris = new Map<string, number[]>();
    const ekey = (a: number, b: number) => a < b ? `${a},${b}` : `${b},${a}`;
    for (let t = 0; t < idxIn.length / 3; t++) {
      const [a, b, c] = [idxIn[t*3] as number, idxIn[t*3+1] as number, idxIn[t*3+2] as number];
      for (const k of [ekey(a,b), ekey(b,c), ekey(c,a)]) {
        if (!edgeTris.has(k)) edgeTris.set(k, []);
        edgeTris.get(k)!.push(t);
      }
    }

    // Find open edges and check for T-junction vertices
    const removed = new Set<number>();
    const extra: number[] = [];

    for (const [k, list] of edgeTris) {
      if (list.length !== 1) continue;
      const [v0, v1] = k.split(",").map(Number);
      const x0 = pos.getX(v0), y0 = pos.getY(v0), z0 = pos.getZ(v0);
      const dx = pos.getX(v1) - x0, dy = pos.getY(v1) - y0, dz = pos.getZ(v1) - z0;
      const len2 = dx*dx + dy*dy + dz*dz;
      if (len2 < 1e-16) continue;

      // Find all vertices that lie strictly between v0 and v1 on the segment
      const between: Array<{t: number; v: number}> = [];
      for (let v = 0; v < V; v++) {
        if (v === v0 || v === v1) continue;
        const px = pos.getX(v) - x0, py = pos.getY(v) - y0, pz = pos.getZ(v) - z0;
        const t = (px*dx + py*dy + pz*dz) / len2;
        if (t < 1e-6 || t > 1 - 1e-6) continue;
        const cx = py*dz - pz*dy, cy = pz*dx - px*dz, cz = px*dy - py*dx;
        if (cx*cx + cy*cy + cz*cz < 1e-10 * len2) between.push({t, v});
      }
      if (between.length === 0) continue;

      // Sort by t along the edge and split the triangle
      between.sort((a, b) => a.t - b.t);
      const triIdx = list[0];
      const [ta, tb, tc] = [idxIn[triIdx*3] as number, idxIn[triIdx*3+1] as number, idxIn[triIdx*3+2] as number];
      const third = [ta, tb, tc].find(v => v !== v0 && v !== v1)!;
      removed.add(triIdx);
      const seq = [v0, ...between.map(b => b.v), v1];
      for (let i = 0; i < seq.length - 1; i++) extra.push(seq[i], seq[i+1], third);
    }

    if (removed.size === 0) return geo;

    const outIdx: number[] = [];
    for (let t = 0; t < idxIn.length / 3; t++) {
      if (!removed.has(t)) outIdx.push(idxIn[t*3] as number, idxIn[t*3+1] as number, idxIn[t*3+2] as number);
    }
    outIdx.push(...extra);

    const out = new THREE.BufferGeometry();
    out.setAttribute("position", geo.attributes.position);
    out.setIndex(outIdx);
    return out;
  }

  const repaired = repairTJunctions(welded);
  welded.dispose();

  const rPos = repaired.attributes.position as THREE.BufferAttribute;
  const rIdx = repaired.index!.array;
  const outVerts: number[] = [];
  const outTris: number[] = [];
  for (let i = 0; i < rPos.count; i++) outVerts.push(rPos.getX(i), rPos.getY(i), rPos.getZ(i));
  for (let i = 0; i < rIdx.length; i++) outTris.push(rIdx[i] as number);
  repaired.dispose();

  return { vertices: outVerts, triangles: outTris };
}

// ─── STL serializer (unchanged) ──────────────────────────────────────────────

export function serializeStlBinary(mesh: ParsedMesh): Buffer {
  const triCount = mesh.triangles.length / 3;
  const buf = Buffer.alloc(84 + triCount * 50);
  buf.write("PrintTrack label mesh", 0, "ascii");
  buf.writeUInt32LE(triCount, 80);

  let offset = 84;
  for (let i = 0; i < triCount; i++) {
    const ai = (mesh.triangles[i*3]   as number) * 3;
    const bi = (mesh.triangles[i*3+1] as number) * 3;
    const ci = (mesh.triangles[i*3+2] as number) * 3;

    const ax = mesh.vertices[ai]   as number, ay = mesh.vertices[ai+1] as number, az = mesh.vertices[ai+2] as number;
    const bx = mesh.vertices[bi]   as number, by = mesh.vertices[bi+1] as number, bz = mesh.vertices[bi+2] as number;
    const cx = mesh.vertices[ci]   as number, cy = mesh.vertices[ci+1] as number, cz = mesh.vertices[ci+2] as number;

    const ux = bx-ax, uy = by-ay, uz = bz-az;
    const vx = cx-ax, vy = cy-ay, vz = cz-az;
    const nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
    const len = Math.sqrt(nx*nx+ny*ny+nz*nz) || 1;

    buf.writeFloatLE(nx/len, offset);    buf.writeFloatLE(ny/len, offset+4);  buf.writeFloatLE(nz/len, offset+8);
    buf.writeFloatLE(ax,     offset+12); buf.writeFloatLE(ay,     offset+16); buf.writeFloatLE(az,     offset+20);
    buf.writeFloatLE(bx,     offset+24); buf.writeFloatLE(by,     offset+28); buf.writeFloatLE(bz,     offset+32);
    buf.writeFloatLE(cx,     offset+36); buf.writeFloatLE(cy,     offset+40); buf.writeFloatLE(cz,     offset+44);
    buf.writeUInt16LE(0, offset+48);
    offset += 50;
  }
  return buf;
}
