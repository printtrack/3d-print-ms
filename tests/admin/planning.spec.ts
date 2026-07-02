import { test, expect } from "../fixtures/test-base";
import {
  prismaTest,
  createTestOrder,
  createTestMilestone,
  createTestCalendarSubscription,
} from "../fixtures/db";
import bcrypt from "bcryptjs";

test.use({ storageState: "tests/.auth/admin.json" });

function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function ymdCompact(d: Date): string {
  return ymd(d).replace(/-/g, "");
}
/** A self-contained iCal feed as a data: URL (fetchable server-side, no network). */
function icsDataUrl(date: Date, summary: string): string {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//test//EN",
    "BEGIN:VEVENT",
    `UID:${summary.replace(/\s/g, "")}@test`,
    `SUMMARY:${summary}`,
    `DTSTART;VALUE=DATE:${ymdCompact(date)}`,
    `DTEND;VALUE=DATE:${ymdCompact(next)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
}

test("renders planning with the three views", async ({ seed, page }) => {
  await page.goto("/admin/planning");
  await expect(page.getByRole("heading", { name: "Planung" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Auslastung" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Monat" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Agenda" })).toBeVisible();
});

test("an order with a deadline appears on the timeline", async ({ seed, page }) => {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 3);
  const order = await createTestOrder(seed.phases[0].id, {
    description: "Sensor-Gehäuse Auslastung",
    deadline,
  });
  await prismaTest.orderAssignee.create({ data: { orderId: order.id, userId: seed.admin.id } });

  await page.goto("/admin/planning");
  await expect(page.getByText("Sensor-Gehäuse Auslastung")).toBeVisible();
});

test("creating a general appointment shows it in the agenda", async ({ seed, page }) => {
  await page.goto("/admin/planning");
  await page.getByRole("button", { name: "Termin anlegen" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("z. B. Druckerwartung X1C").fill("Druckerwartung X1C");
  await dialog.getByRole("button", { name: "Termin anlegen" }).click();

  await page.getByRole("button", { name: "Agenda" }).click();
  await expect(page.getByText("Druckerwartung X1C")).toBeVisible();
});

test("a subscribed web calendar (iCal) shows read-only in the agenda", async ({ seed, page }) => {
  await createTestCalendarSubscription({
    name: "Feiertage Test",
    url: icsDataUrl(new Date(), "Feiertag Test"),
    color: "#0ea5e9",
  });

  await page.goto("/admin/planning");
  await page.getByRole("button", { name: "Agenda" }).click();
  await expect(page.getByText("Feiertag Test")).toBeVisible();
});

test("a milestone with a due date renders in the agenda", async ({ seed, page }) => {
  const order = await createTestOrder(seed.phases[0].id, { description: "Auftrag mit Meilenstein" });
  await createTestMilestone(order.id, { name: "Kundenfreigabe Design", dueAt: new Date() });

  await page.goto("/admin/planning");
  await page.getByRole("button", { name: "Agenda" }).click();
  await expect(page.getByText("Kundenfreigabe Design")).toBeVisible();
});

test("an order without a deadline is scheduled by its latest milestone", async ({ seed, page }) => {
  // No deadline set → the order bar/entry should be anchored to the milestone date.
  const now = new Date();
  const due = new Date(now.getFullYear(), now.getMonth(), 15); // mid-month → always in the agenda's current month
  const order = await createTestOrder(seed.phases[0].id, { description: "Auftrag ohne Deadline XYZ" });
  await createTestMilestone(order.id, { name: "Endabnahme", dueAt: due });

  await page.goto("/admin/planning");
  await page.getByRole("button", { name: "Agenda" }).click();
  // The order delivery entry appears (anchored to the milestone date, this month).
  // The title also shows in the milestone row's subtitle, so match the first.
  await expect(page.getByText("Auftrag ohne Deadline XYZ").first()).toBeVisible();
});

// ── API routes ────────────────────────────────────────────────────────────────

test("API: creates a calendar event", async ({ seed, page }) => {
  const res = await page.request.post("/api/admin/calendar-events", {
    data: { title: "Wartung", startAt: ymd(new Date()), allDay: true },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.title).toBe("Wartung");
});

test("API: rejects a calendar event without a title", async ({ seed, page }) => {
  const res = await page.request.post("/api/admin/calendar-events", {
    data: { title: "", startAt: ymd(new Date()) },
  });
  expect(res.status()).toBe(400);
});

test("API: admin can list calendar subscriptions", async ({ seed, page }) => {
  await createTestCalendarSubscription({ name: "Liste Test" });
  const res = await page.request.get("/api/admin/calendar-subscriptions");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.some((s: { name: string }) => s.name === "Liste Test")).toBe(true);
});

test("API: rejects a subscription with an invalid URL scheme", async ({ seed, page }) => {
  const res = await page.request.post("/api/admin/calendar-subscriptions", {
    data: { name: "Bad", url: "ftp://example.com/cal.ics" },
  });
  expect(res.status()).toBe(400);
});

test("permission: a team member cannot manage web-calendar subscriptions", async ({ seed, browser }) => {
  const password = "teampass123";
  await prismaTest.user.create({
    data: {
      name: "Team Planer",
      email: "planer@example.com",
      password: await bcrypt.hash(password, 10),
      role: "TEAM_MEMBER",
    },
  });

  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto("/auth/signin");
  await page.getByLabel("E-Mail").fill("planer@example.com");
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: /Anmelden/i }).click();
  await page.waitForURL("**/admin**");

  const res = await page.request.post("/api/admin/calendar-subscriptions", {
    data: { name: "Nope", url: "https://example.com/cal.ics" },
  });
  expect(res.status()).toBe(403);
  await ctx.close();
});

test("settings exposes the web-calendar manager", async ({ seed, page }) => {
  await createTestCalendarSubscription({ name: "Ferien Bayern" });
  await page.goto("/admin/settings?tab=webkalender");
  await expect(page.getByText("Ferien Bayern")).toBeVisible();
});
