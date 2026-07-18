import { test, expect, loginAs } from "../fixtures/test-base";
import {
  createTestMachine,
  createTestPrintJob,
  createTestPrintJobFile,
  createTestUser,
  createTestTeamRole,
  prismaTest,
} from "../fixtures/db";
import fs from "fs";
import path from "path";
import type { Page } from "@playwright/test";

test.use({ storageState: "tests/.auth/admin.json" });

// Job files live at UPLOAD_DIR/jobs/{jobId}/{filename}; the server reads the
// bytes back when dispatching, so the file must actually exist on disk.
function writeJobFile(jobId: string, filename: string) {
  const dir = path.join(process.cwd(), "public/uploads/jobs", jobId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), "; G-code\nG28\nG1 X0 Y0\n");
}

async function connectMock(page: Page, machineId: string, mockState: string) {
  const res = await page.request.patch(`/api/admin/machines/${machineId}`, {
    data: { connection: { profile: "mock", mockState } },
  });
  expect(res.ok()).toBeTruthy();
}

// Set up a connected machine + a SLICED job with a slice file on disk.
async function seedJobWithFile(page: Page, mockState: string) {
  const machine = await createTestMachine();
  await connectMock(page, machine.id, mockState);
  const job = await createTestPrintJob(machine.id, { status: "SLICED" });
  await createTestPrintJobFile(job.id, { filename: `${job.id}.gcode` });
  writeJobFile(job.id, `${job.id}.gcode`);
  return { machine, job };
}

test.describe("printer dispatch", () => {
  test("auto-starts the print when the printer is idle", async ({ seed, page }) => {
    void seed;
    const { job } = await seedJobWithFile(page, "IDLE");

    const res = await page.request.post(`/api/admin/jobs/${job.id}/dispatch`, {
      data: {},
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.dispatch.status).toBe("STARTED");

    const fresh = await prismaTest.printJob.findUnique({ where: { id: job.id } });
    expect(fresh?.status).toBe("IN_PROGRESS");
  });

  test("holds the dispatch when a finished part is still on the bed", async ({ seed, page }) => {
    void seed;
    const { job } = await seedJobWithFile(page, "FINISHED");

    const res = await page.request.post(`/api/admin/jobs/${job.id}/dispatch`, {
      data: {},
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.dispatch.status).toBe("HELD");
    expect(body.dispatch.holdReason).toBe("bed_occupied");

    const fresh = await prismaTest.printJob.findUnique({ where: { id: job.id } });
    expect(fresh?.status).toBe("SLICED"); // unchanged — nothing was started
  });

  test("a held dispatch can be started manually", async ({ seed, page }) => {
    void seed;
    const { job } = await seedJobWithFile(page, "FINISHED");
    const created = await page.request.post(`/api/admin/jobs/${job.id}/dispatch`, { data: {} });
    const dispatchId = (await created.json()).dispatch.id;

    const res = await page.request.post(`/api/admin/dispatches/${dispatchId}/start`);
    expect(res.status()).toBe(200);
    expect((await res.json()).dispatch.status).toBe("STARTED");

    const fresh = await prismaTest.printJob.findUnique({ where: { id: job.id } });
    expect(fresh?.status).toBe("IN_PROGRESS");
  });

  test("refresh advances a started dispatch to done and hands the job to verification", async ({ seed, page }) => {
    void seed;
    const { machine, job } = await seedJobWithFile(page, "IDLE");
    await page.request.post(`/api/admin/jobs/${job.id}/dispatch`, { data: {} });

    // The printer finishes the print.
    await connectMock(page, machine.id, "FINISHED");
    const res = await page.request.post(`/api/admin/dispatches/refresh`);
    expect(res.status()).toBe(200);

    const dispatch = await prismaTest.printDispatch.findFirst({ where: { printJobId: job.id } });
    expect(dispatch?.status).toBe("DONE");
    const fresh = await prismaTest.printJob.findUnique({ where: { id: job.id } });
    expect(fresh?.status).toBe("AWAITING_VERIFICATION");
  });

  test("lists the dispatches of a job", async ({ seed, page }) => {
    void seed;
    const { job } = await seedJobWithFile(page, "IDLE");
    await page.request.post(`/api/admin/jobs/${job.id}/dispatch`, { data: {} });

    const res = await page.request.get(`/api/admin/jobs/${job.id}/dispatch`);
    expect(res.status()).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  test("a running dispatch can be cancelled", async ({ seed, page }) => {
    void seed;
    const { job } = await seedJobWithFile(page, "IDLE");
    const created = await page.request.post(`/api/admin/jobs/${job.id}/dispatch`, { data: {} });
    const dispatchId = (await created.json()).dispatch.id;

    const res = await page.request.post(`/api/admin/dispatches/${dispatchId}/cancel`);
    expect(res.status()).toBe(200);
    expect((await res.json()).dispatch.status).toBe("CANCELLED");
  });

  test("fails cleanly when the printer is not connected", async ({ seed, page }) => {
    void seed;
    const machine = await createTestMachine();
    const job = await createTestPrintJob(machine.id, { status: "SLICED" });
    await createTestPrintJobFile(job.id, { filename: `${job.id}.gcode` });
    writeJobFile(job.id, `${job.id}.gcode`);

    const res = await page.request.post(`/api/admin/jobs/${job.id}/dispatch`, { data: {} });
    expect(res.status()).toBe(409);
  });

  test("test-connection reports the mock printer state", async ({ seed, page }) => {
    void seed;
    const machine = await createTestMachine();
    await connectMock(page, machine.id, "IDLE");

    const res = await page.request.post(`/api/admin/machines/${machine.id}/test-connection`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status.state).toBe("IDLE");
  });

  test("machine status endpoint returns the live printer state", async ({ seed, page }) => {
    void seed;
    const machine = await createTestMachine();
    await connectMock(page, machine.id, "PRINTING");

    const res = await page.request.get(`/api/admin/machines/${machine.id}/status`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.status.state).toBe("PRINTING");
  });

  test("connection token is never returned in plaintext", async ({ seed, page }) => {
    void seed;
    const machine = await createTestMachine();
    const patch = await page.request.patch(`/api/admin/machines/${machine.id}`, {
      data: {
        connection: {
          profile: "prusa-core-one",
          token: "super-secret-token-abc",
          baseUrl: "http://192.168.1.50",
        },
      },
    });
    expect(patch.ok()).toBeTruthy();

    const res = await page.request.get(`/api/admin/machines`);
    const raw = await res.text();
    expect(raw).not.toContain("super-secret-token-abc");
    expect(raw).not.toContain("connectionConfigEnc");

    const machines = JSON.parse(raw);
    const found = machines.find((m: { id: string }) => m.id === machine.id);
    expect(found.connection.hasToken).toBe(true);
    expect(found.connection.token).toBeUndefined();
  });

  test("selecting a vendor+model profile sets the transport and exposes vendor/model", async ({ seed, page }) => {
    void seed;
    const machine = await createTestMachine();
    const patch = await page.request.patch(`/api/admin/machines/${machine.id}`, {
      data: {
        connection: {
          profile: "ultimaker-s3",
          token: "df-oauth-token",
          printerId: "cluster-123",
        },
      },
    });
    expect(patch.ok()).toBeTruthy();
    const updated = await patch.json();
    expect(updated.connection.type).toBe("ULTIMAKER_CLOUD");
    expect(updated.connection.profile).toBe("ultimaker-s3");
    expect(updated.connection.vendor).toBe("Ultimaker");
    expect(updated.connection.model).toBe("S3");
    expect(updated.connection.printerId).toBe("cluster-123");
    expect(updated.connection.hasToken).toBe(true);
    expect(updated.connection.token).toBeUndefined();
  });

  test("Prusa profiles map to cloud (Connect) and local (PrusaLink) transports", async ({ seed, page }) => {
    void seed;
    const cloud = await createTestMachine();
    const cloudRes = await page.request.patch(`/api/admin/machines/${cloud.id}`, {
      data: {
        connection: { profile: "prusa-core-one", token: "prusa-connect-api-key" },
      },
    });
    expect((await cloudRes.json()).connection.type).toBe("PRUSA_CONNECT");

    const local = await createTestMachine();
    const localRes = await page.request.patch(`/api/admin/machines/${local.id}`, {
      data: {
        connection: {
          profile: "prusa-core-one-local",
          token: "prusalink-key",
          baseUrl: "http://192.168.1.50",
        },
      },
    });
    expect((await localRes.json()).connection.type).toBe("PRUSALINK");
  });

  test("an unknown profile is rejected", async ({ seed, page }) => {
    void seed;
    const machine = await createTestMachine();
    const res = await page.request.patch(`/api/admin/machines/${machine.id}`, {
      data: { connection: { profile: "does-not-exist" } },
    });
    expect(res.status()).toBe(400);
  });

  test("a member without jobs.manage may not dispatch", async ({ seed, page, browser }) => {
    void seed;
    const { job } = await seedJobWithFile(page, "IDLE");

    const role = await createTestTeamRole({
      name: "Nur Ansicht",
      restricted: false,
      permissions: ["jobs.verify"], // deliberately not jobs.manage
    });
    await createTestUser({ email: "viewer@example.com", teamRoleId: role.id });

    const { context, page: member } = await loginAs(browser, "viewer@example.com");
    const res = await member.request.post(`/api/admin/jobs/${job.id}/dispatch`, { data: {} });
    expect(res.status()).toBe(403);
    await context.close();
  });

  test("a non-admin may not configure a printer connection", async ({ seed, page, browser }) => {
    void seed;
    const machine = await createTestMachine();

    const role = await createTestTeamRole({
      name: "Team",
      restricted: false,
      permissions: ["jobs.manage"],
    });
    await createTestUser({ email: "teammate@example.com", teamRoleId: role.id });

    const { context, page: member } = await loginAs(browser, "teammate@example.com");
    const res = await member.request.patch(`/api/admin/machines/${machine.id}`, {
      data: { connection: { profile: "mock", mockState: "IDLE" } },
    });
    expect(res.status()).toBe(403);
    await context.close();
    void page;
  });
});
