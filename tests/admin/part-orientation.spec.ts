import { test, expect } from "../fixtures/test-base";
import {
  createTestOrderWithStlFile,
  createTestFilament,
  createTestMachine,
  createTestPrintJob,
  createTestPrintJobPart,
  prismaTest,
} from "../fixtures/db";
import JSZip from "jszip";

test.use({ storageState: "tests/.auth/admin.json" });

// Helper: valid unit quaternion (90° rotation around Y)
const Q_90Y = { qx: 0, qy: 0.7071067811865476, qz: 0, qw: 0.7071067811865476 };

test("orientation: PATCH saves quaternion and writes AuditLog", async ({ seed, page }) => {
  const { order, part } = await createTestOrderWithStlFile();

  const res = await page.request.patch(`/api/admin/parts/${part.id}/orientation`, {
    data: Q_90Y,
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.orientQy).toBeCloseTo(Q_90Y.qy, 5);
  expect(body.orientQw).toBeCloseTo(Q_90Y.qw, 5);

  // Verify DB
  const updated = await prismaTest.orderPart.findUniqueOrThrow({ where: { id: part.id } });
  expect(updated.orientQy).toBeCloseTo(Q_90Y.qy, 5);

  // Verify AuditLog entry
  const log = await prismaTest.auditLog.findFirst({
    where: { orderId: order.id, action: "PART_ORIENTATION_SET" },
  });
  expect(log).not.toBeNull();
});

test("orientation: DELETE resets to identity and writes AuditLog", async ({ seed, page }) => {
  const { order, part } = await createTestOrderWithStlFile();

  // Set a non-identity orientation first
  await page.request.patch(`/api/admin/parts/${part.id}/orientation`, { data: Q_90Y });

  const res = await page.request.delete(`/api/admin/parts/${part.id}/orientation`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.orientQx).toBe(0);
  expect(body.orientQy).toBe(0);
  expect(body.orientQz).toBe(0);
  expect(body.orientQw).toBe(1);

  const log = await prismaTest.auditLog.findFirst({
    where: { orderId: order.id, action: "PART_ORIENTATION_RESET" },
  });
  expect(log).not.toBeNull();
});

test("orientation: non-normalized quaternion returns 400", async ({ seed, page }) => {
  const { part } = await createTestOrderWithStlFile();

  const res = await page.request.patch(`/api/admin/parts/${part.id}/orientation`, {
    data: { qx: 1, qy: 1, qz: 1, qw: 1 }, // |q| = 2, not normalized
  });
  expect(res.status()).toBe(400);
});

test("orientation: unauthenticated request returns 401", async ({ page }) => {
  // Use a new page context without admin auth
  const { part } = await createTestOrderWithStlFile();
  const unauthedRes = await page.request.patch(`/api/admin/parts/${part.id}/orientation`, {
    data: Q_90Y,
    headers: { cookie: "" }, // clear auth cookie
  });
  // Server may return 401 or 403 depending on middleware; either blocks access
  expect([401, 403]).toContain(unauthedRes.status());
});

test("orientation: orca-download 3MF contains non-identity transform when orientation is set", async ({ seed, page }) => {
  const { part, file } = await createTestOrderWithStlFile();

  // Set a non-trivial orientation
  await page.request.patch(`/api/admin/parts/${part.id}/orientation`, { data: Q_90Y });

  // Link the part to a print job and download
  const machine = await createTestMachine();
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  await createTestPrintJobPart(job.id, part.id);

  const res = await page.request.get(`/api/admin/jobs/${job.id}/orca-download`);
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toContain("3mf");

  const buffer = await res.body();
  const zip = await JSZip.loadAsync(buffer);
  const modelXml = await zip.file("3D/3dmodel.model")!.async("string");

  // objectid="1" is the part's STL — it must have a non-identity transform
  // The label mesh (objectid="2") always uses identity, so we scope to objectid="1"
  const itemMatch = modelXml.match(/<item objectid="1" transform="([^"]+)"/);
  expect(itemMatch).not.toBeNull();
  const transform = itemMatch![1];
  expect(transform).not.toBe("1 0 0 0 1 0 0 0 1 0 0 0");

  void file; // suppress unused warning
});

test("orientation: stl-download rotates vertices when orientation is set", async ({ seed, page }) => {
  const { part, file } = await createTestOrderWithStlFile();

  // Read original first vertex via file API
  const rawRes = await page.request.get(`/api/files/${part.orderId}/${file.filename}`);
  expect(rawRes.ok()).toBeTruthy();
  const rawBuf = await rawRes.body();
  // Binary STL layout: 84 header + (12 normal + 3×12 vertices + 2 attr) per triangle
  // Second vertex (non-zero) starts at byte 108 (84 header + 12 normal + 12 first vertex)
  // Use second vertex (10, 0, 0) — first vertex is at origin and never changes under rotation
  const origX = rawBuf.readFloatLE(108); // = 10.0

  // Set a 90° rotation around Y → X becomes Z, Z becomes -X
  await page.request.patch(`/api/admin/parts/${part.id}/orientation`, { data: Q_90Y });

  const machine = await createTestMachine();
  const job = await createTestPrintJob(machine.id, { status: "PLANNED" });
  await createTestPrintJobPart(job.id, part.id);

  const zipRes = await page.request.get(`/api/admin/jobs/${job.id}/stl-download`);
  expect(zipRes.ok()).toBeTruthy();

  const zipBuf = await zipRes.body();
  const zip = await JSZip.loadAsync(zipBuf);
  const stlEntries = Object.keys(zip.files).filter((name) => name.endsWith(".stl") && !zip.files[name].dir);
  expect(stlEntries.length).toBeGreaterThan(0);

  const stlArrayBuffer = await zip.file(stlEntries[0])!.async("arraybuffer");
  const stlBuf = Buffer.from(stlArrayBuffer);
  // Read second vertex in output STL (same offset 108 — output is also non-indexed binary STL)
  const rotX = stlBuf.readFloatLE(108);

  // After 90° Y rotation, vertex (10,0,0) becomes (0,0,10) — x coordinate changes from 10 to ~0
  expect(Math.abs(rotX - origX)).toBeGreaterThan(0.5);
});

test("orientation: auto-planner skips part when user-set orientation exceeds machine limits", async ({ seed, page }) => {
  // Part: 80×80×60mm — fits on machine in default orientation (footprint 80×80, height 60 ≤ 100)
  // Machine: 100×100×100mm build volume
  // After user sets 90° Y rotation: rotated bbox becomes {x:60, y:80, z:80}
  //   → height 80 ≤ 100 OK, footprint 60×80 ≤ 100×100 OK → still fits
  // Instead use a big rotation that makes footprint > machine plate:
  // Part: 80×80×150mm. Machine: 100×100×200mm
  //   Default: height=150 ≤ 200 ✓; footprint 80×80 ≤ 100 ✓ → planner proposes it
  //   After 90° X rotation: rotated bbox {x:80, y:150, z:80} → d=150 > 100 → SKIPPED
  const machine = await createTestMachine({ buildVolumeX: 100, buildVolumeY: 100, buildVolumeZ: 200 });

  const { part } = await createTestOrderWithStlFile();
  const filament = await createTestFilament();

  const printReadyPhase = seed.partPhases.find((p) => p.isPrintReady);
  await prismaTest.orderPart.update({
    where: { id: part.id },
    data: {
      bboxXmm: 80, bboxYmm: 80, bboxZmm: 150,
      filamentId: filament.id,
      ...(printReadyPhase ? { partPhaseId: printReadyPhase.id } : {}),
    },
  });

  // With default/identity orientation: planner proposes the part (fits: 80×80 footprint, h=150 ≤ 200)
  const resDefault = await page.request.post("/api/admin/jobs/plan", {
    data: {},
  });
  expect(resDefault.ok()).toBeTruthy();
  const defaultResult = await resDefault.json();
  const defaultSkipped = (defaultResult.skipped ?? []) as Array<{ orderPartId: string }>;
  expect(defaultSkipped.some((s: { orderPartId: string }) => s.orderPartId === part.id)).toBe(false);

  // Set 90° rotation around X: rotated bbox becomes {x:80, y:150, z:80}
  // depth (150mm) > machine plate (100mm) → planner SKIPS
  const Q_90X = { qx: 0.7071067811865476, qy: 0, qz: 0, qw: 0.7071067811865476 };
  await page.request.patch(`/api/admin/parts/${part.id}/orientation`, { data: Q_90X });

  const resOriented = await page.request.post("/api/admin/jobs/plan", {
    data: {},
  });
  expect(resOriented.ok()).toBeTruthy();
  const orientedResult = await resOriented.json();
  // With user-forced orientation, the part's footprint exceeds machine → skipped
  const orientedSkipped = (orientedResult.skipped ?? []) as Array<{ orderPartId: string }>;
  expect(orientedSkipped.some((s: { orderPartId: string }) => s.orderPartId === part.id)).toBe(true);
});
