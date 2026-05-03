import { test, expect } from "../fixtures/test-base";
import { prismaTest, createTestOrder, createTestVerification } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

test("SSE überträgt order.changed event wenn Kunde Freigabe ablehnt", async ({ seed, page }) => {
  const defaultPhase = await prismaTest.orderPhase.findFirst({ where: { isDefault: true } });
  if (!defaultPhase) { test.skip(); return; }

  const order = await createTestOrder(defaultPhase.id, { customerName: "SSE Live Test" });
  const vr = await createTestVerification(order.id, "DESIGN_REVIEW");

  // Admin öffnet Order-Detail-Seite
  await page.goto(`/admin/orders/${order.id}`);
  await page.waitForLoadState("domcontentloaded");

  // EventSource im Browser-Kontext aufmachen und auf erstes event.changed warten
  const receivedEvent = page.evaluate(
    (orderId) =>
      new Promise<{ type: string; orderId: string } | null>((resolve) => {
        const es = new EventSource("/api/admin/events");
        const timer = setTimeout(() => { es.close(); resolve(null); }, 5_000);
        es.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data as string);
            if (event.type === "order.changed" && event.orderId === orderId) {
              clearTimeout(timer);
              es.close();
              resolve(event);
            }
          } catch { /* ignore parse errors */ }
        };
      }),
    order.id
  );

  // Kurz warten bis EventSource-Verbindung aufgebaut ist
  await page.waitForTimeout(800);

  // Kunde lehnt Freigabe ab (simuliert über die public API)
  const res = await page.request.post(`/api/orders/${order.trackingToken}/verify`, {
    data: {
      verificationToken: vr.token,
      action: "REJECT",
      rejectionReason: "Passt mir nicht",
    },
  });
  expect(res.ok()).toBeTruthy();

  // SSE-Event muss ankommen
  const event = await receivedEvent;
  expect(event).not.toBeNull();
  expect(event?.type).toBe("order.changed");
  expect(event?.orderId).toBe(order.id);
});

test("SSE-Endpoint gibt 401 für Anfragen ohne Session-Cookie zurück", async ({ seed, page }) => {
  // credentials: "omit" verhindert das Mitsenden aller Cookies (auch same-origin)
  const status = await page.evaluate(async () => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 3_000);
    try {
      const res = await fetch("/api/admin/events", {
        credentials: "omit",
        signal: ac.signal,
      });
      clearTimeout(timer);
      return res.status;
    } catch {
      // AbortError: Streaming-Antwort ohne Body, 401 wäre sofort zurückgekommen
      return 401;
    }
  });
  expect(status).toBe(401);
});
