import type { Page } from "@playwright/test";
import { test, expect, loginAs } from "../fixtures/test-base";
import { createTestLandingBlock, createTestTeamRole, createTestUser, prismaTest } from "../fixtures/db";

test.use({ storageState: "tests/.auth/admin.json" });

// The landing page builder. Two invariants sit above all the rest:
//   1. An install that never opens the editor renders exactly what it always did.
//   2. None of the editing reaches a visitor — not the markup, not the JS.
// The first test of each describe below guards one of them.

/** The editor lives inside the preview; almost everything happens in that frame. */
function preview(page: Page) {
  return page.frameLocator('[data-testid="landing-preview"]');
}

/**
 * A block's floating toolbar.
 *
 * Deliberately NOT reached via `block.hover()` first: hovering a full-height
 * section aims at its centre, which scrolls the admin page around the iframe and
 * leaves the click landing on the sidebar. Playwright hovers an element before
 * clicking it anyway, which is what reveals the toolbar — and it stays clickable
 * while faded out on purpose (see globals.css).
 */
function blockToolbar(page: Page, index: number) {
  return preview(page).locator("[data-landing-block]").nth(index).locator(".landing-edit-chrome").first();
}

/** Open /admin/landing with the default blocks materialized and editing live. */
async function openEditor(page: Page) {
  await page.request.post("/api/admin/landing/init");
  await page.goto("/admin/landing");
  // The frame carries edit=1 only once the blocks are real rows. Waiting for a
  // contenteditable proves both that it loaded and that the bridge is listening.
  await expect(
    preview(page).locator('[data-landing-edit][contenteditable="true"]').first(),
  ).toBeVisible();
}

/** Make the current draft the version visitors see. */
async function publish(page: Page) {
  const res = await page.request.post("/api/admin/landing/publish");
  expect(res.ok()).toBeTruthy();
}

test.describe("default content fallback", () => {
  test("an empty table renders the built-in default page", async ({ seed, page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Deine Idee\./ })).toBeVisible();
    await expect(page.getByText("Kreativität trifft Technik")).toBeVisible();
    // Nothing was written just by looking at the page.
    expect(await prismaTest.landingBlock.count()).toBe(0);
  });

  test("the editor offers the defaults but does not save them unasked", async ({ seed, page }) => {
    await page.goto("/admin/landing");
    await expect(page.getByTestId("landing-pristine-banner")).toBeVisible();
    // Preview without edit=1: the defaults are shown, but nothing is editable.
    await expect(preview(page).locator("[data-landing-edit]")).toHaveCount(0);
    expect(await prismaTest.landingBlock.count()).toBe(0);
  });

  test("initializing turns the defaults into editable rows", async ({ seed, page }) => {
    await page.goto("/admin/landing");
    await page.getByRole("button", { name: "Seite anpassen" }).click();
    await expect(page.getByTestId("landing-pristine-banner")).toBeHidden();
    expect(await prismaTest.landingBlock.count()).toBe(4);
    await expect(preview(page).locator("[data-landing-block]")).toHaveCount(4);
  });

  test("init is idempotent — a second call does not duplicate the page", async ({ seed, page }) => {
    await page.request.post("/api/admin/landing/init");
    const res = await page.request.post("/api/admin/landing/init");
    expect(res.ok()).toBeTruthy();
    expect(await prismaTest.landingBlock.count()).toBe(4);
  });
});

test.describe("nothing leaks to the public page", () => {
  test("no editable copy, no toolbars, no editor markup", async ({ seed, page }) => {
    await page.request.post("/api/admin/landing/init");
    await page.goto("/");
    await expect(page.locator("[data-landing-edit]")).toHaveCount(0);
    await expect(page.locator(".landing-edit-chrome")).toHaveCount(0);
    await expect(page.locator("[data-landing-icon-edit]")).toHaveCount(0);
  });

  test("edit=1 does nothing without a session", async ({ seed, browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/?edit=1");
    await expect(page.locator("[data-landing-edit]")).toHaveCount(0);
    await expect(page.locator(".landing-edit-chrome")).toHaveCount(0);
    await context.close();
  });

  test("edit=1 does nothing for a member without landing.edit", async ({ seed, browser, page }) => {
    await page.request.post("/api/admin/landing/init");
    const role = await createTestTeamRole({ permissions: ["orders.edit"] });
    await createTestUser({ email: "kein-inline@example.com", teamRoleId: role.id });

    const session = await loginAs(browser, "kein-inline@example.com");
    await session.page.goto("/?edit=1");
    await expect(session.page.locator("[data-landing-edit]")).toHaveCount(0);
    await expect(session.page.locator(".landing-edit-chrome")).toHaveCount(0);
    await session.context.close();
  });

  test("a hidden block stays off the public page but shows in the editor", async ({ seed, page }) => {
    await page.request.post("/api/admin/landing/init");
    const features = await prismaTest.landingBlock.findFirst({ where: { type: "features" } });
    await page.request.patch(`/api/admin/landing/${features!.id}`, { data: { visible: false } });
    await publish(page);

    await page.goto("/");
    await expect(page.getByText("Kreativität trifft Technik")).toBeHidden();

    // You cannot bring back what you cannot see.
    await page.goto("/admin/landing");
    await expect(preview(page).getByText("Kreativität trifft Technik")).toBeVisible();
  });
});

test.describe("draft and publish", () => {
  test("draft edits stay private until published", async ({ seed, page }) => {
    await openEditor(page);

    const headline = preview(page).locator(
      '[data-landing-edit][contenteditable="true"][data-field="headline2"]',
    );
    await expect(headline).toHaveText("Wir drucken sie.");
    await headline.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Nur im Entwurf.");

    // Saved to the draft…
    await expect(async () => {
      const hero = await prismaTest.landingBlock.findFirst({ where: { type: "hero" } });
      expect((hero?.data as { headline2: { de: string } }).headline2.de).toBe("Nur im Entwurf.");
    }).toPass();

    // …but visitors still see the previous (here: default) version.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Nur im Entwurf\./ })).toBeHidden();
    await expect(page.getByRole("heading", { name: /Wir drucken sie\./ })).toBeVisible();

    // Publishing makes it live.
    await publish(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Nur im Entwurf\./ })).toBeVisible();
  });

  test("the header shows unpublished changes, then clears on publish", async ({ seed, page }) => {
    await openEditor(page);
    // init created a draft that was never published → unpublished.
    await expect(page.getByTestId("landing-publish-status")).toHaveText("Entwurf – nicht veröffentlicht");
    await expect(page.getByTestId("landing-publish")).toBeEnabled();

    await page.getByTestId("landing-publish").click();
    await expect(page.getByTestId("landing-publish-status")).toHaveText("Veröffentlicht");
    await expect(page.getByTestId("landing-publish")).toBeDisabled();
  });

  test("editing after publish flips the status back to unpublished", async ({ seed, page }) => {
    await openEditor(page);
    await page.getByTestId("landing-publish").click();
    await expect(page.getByTestId("landing-publish-status")).toHaveText("Veröffentlicht");

    // The preview reports the edit up to the frame (postMessage), no reload.
    const headline = preview(page).locator(
      '[data-landing-edit][contenteditable="true"][data-field="headline2"]',
    );
    await headline.click();
    await page.keyboard.type("x");

    await expect(page.getByTestId("landing-publish-status")).toHaveText("Entwurf – nicht veröffentlicht");
  });

  test("discard resets the draft to the last published version", async ({ seed, page }) => {
    await page.request.post("/api/admin/landing/init");
    // Publish version A.
    const hero = await prismaTest.landingBlock.findFirst({ where: { type: "hero" } });
    const dataA = hero!.data as Record<string, unknown>;
    await page.request.patch(`/api/admin/landing/${hero!.id}`, {
      data: { data: { ...dataA, headline2: { de: "Version A", en: "" } } },
    });
    await publish(page);

    // Edit to B in the draft, then discard.
    await page.request.patch(`/api/admin/landing/${hero!.id}`, {
      data: { data: { ...dataA, headline2: { de: "Version B", en: "" } } },
    });
    const res = await page.request.post("/api/admin/landing/discard");
    expect(res.ok()).toBeTruthy();

    // Draft is back at A — B is gone. Note the row id changes: discard rebuilds
    // the rows from the snapshot.
    const restored = await prismaTest.landingBlock.findFirst({ where: { type: "hero" } });
    expect((restored!.data as { headline2: { de: string } }).headline2.de).toBe("Version A");
  });

  test("discard with nothing ever published empties the draft", async ({ seed, page }) => {
    await page.request.post("/api/admin/landing/init");
    expect(await prismaTest.landingBlock.count()).toBe(4);
    await page.request.post("/api/admin/landing/discard");
    // Never published → discard reverts to "no draft" = pristine defaults.
    expect(await prismaTest.landingBlock.count()).toBe(0);
  });

  test("MySQL JSON key reordering does not make a published page look unpublished", async ({
    seed,
    page,
  }) => {
    // Regression guard for the stable-stringify: publish, change nothing, and the
    // state must read as published even though the row's JSON came back from
    // MySQL with keys in a different order than the stored snapshot.
    await page.request.post("/api/admin/landing/init");
    await publish(page);
    const res = await page.request.get("/api/admin/landing");
    expect(res.ok()).toBeTruthy();
    await page.goto("/admin/landing");
    await expect(page.getByTestId("landing-publish-status")).toHaveText("Veröffentlicht");
  });
});

test.describe("editing text in place", () => {
  test("typing saves to the draft, only the edited language", async ({ seed, page }) => {
    await openEditor(page);

    // [contenteditable] is set by the bridge, not the server: waiting for it is
    // waiting for a listener to exist. Without it the keystrokes land in a
    // document nobody is listening to and vanish.
    const headline = preview(page).locator(
      '[data-landing-edit][contenteditable="true"][data-field="headline2"]',
    );
    await expect(headline).toHaveText("Wir drucken sie.");
    await headline.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Inline getippt.");

    // Public visibility is covered by "draft edits stay private until published";
    // here we only care that the right field, in the right language, was saved.
    await expect(async () => {
      const hero = await prismaTest.landingBlock.findFirst({ where: { type: "hero" } });
      const data = hero?.data as { headline2: { de: string; en: string } };
      expect(data.headline2.de).toBe("Inline getippt.");
      // Only the edited language is written — English keeps its own text.
      expect(data.headline2.en).toBe("We print it.");
    }).toPass();
  });

  test("editing the English version leaves German alone", async ({ seed, page }) => {
    await openEditor(page);
    await page.getByTestId("landing-locale-en").click();

    // [contenteditable] is set by the bridge, not the server: waiting for it is
    // waiting for a listener to exist. Without it the keystrokes land in a
    // document nobody is listening to and vanish.
    const headline = preview(page).locator(
      '[data-landing-edit][contenteditable="true"][data-field="headline2"]',
    );
    await expect(headline).toHaveText("We print it.");
    await headline.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Typed in English.");

    await expect(async () => {
      const hero = await prismaTest.landingBlock.findFirst({ where: { type: "hero" } });
      const data = hero?.data as { headline2: { de: string; en: string } };
      expect(data.headline2.en).toBe("Typed in English.");
      expect(data.headline2.de).toBe("Wir drucken sie.");
    }).toPass();
  });

  test("a step numeral is a bare string, not a translated one", async ({ seed, page }) => {
    await openEditor(page);

    const numeral = preview(page)
      .locator('[data-landing-edit][contenteditable="true"][data-field="items.number"]')
      .first();
    await numeral.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("A");

    await expect(async () => {
      const steps = await prismaTest.landingBlock.findFirst({ where: { type: "steps" } });
      const data = steps?.data as { items: { number: unknown }[] };
      // Written as the string itself. Wrapped in {de,en} it would fail the
      // schema and never reach the page.
      expect(data.items[0].number).toBe("A");
    }).toPass();
  });

  test("a cleared field stays clickable, so it can be filled again", async ({ seed, page }) => {
    await createTestLandingBlock({
      type: "hero",
      position: 0,
      data: {
        background: "dark",
        eyebrow: { de: "", en: "" },
        headline1: { de: "Da", en: "" },
        headline2: { de: "", en: "" },
        subheadline: { de: "", en: "" },
        ctaLabel: { de: "", en: "" },
        ctaHref: "#order-form",
      },
    });

    await page.goto("/");
    await expect(page.locator('[data-field="eyebrow"]')).toHaveCount(0);

    await page.goto("/?edit=1");
    await expect(page.locator('[data-landing-edit][data-field="eyebrow"]')).toBeVisible();
  });
});

test.describe("editing everything else in place", () => {
  test("the block toolbar appears on hover and carries every block control", async ({
    seed,
    page,
  }) => {
    await openEditor(page);

    const block = preview(page).locator('[data-landing-block]').nth(1);
    const toolbar = block.locator(".landing-edit-chrome").first();

    // Faded out until you look at the block — the preview has to read as the
    // page, not as a control panel. Asserted on opacity, not toBeVisible():
    // Playwright counts an opacity-0 element as visible, so toBeVisible() would
    // pass here whether the rule works or not.
    await expect(toolbar).toHaveCSS("opacity", "0");
    await block.hover();
    await expect(toolbar).toHaveCSS("opacity", "1");

    for (const label of [
      "Block nach oben",
      "Block nach unten",
      "Hintergrund",
      "Block ausblenden",
      "Block darunter einfügen",
      "Block löschen",
    ]) {
      await expect(toolbar.getByRole("button", { name: label })).toBeVisible();
    }
  });

  test("picking an icon and a tone saves both", async ({ seed, page }) => {
    await openEditor(page);

    await preview(page).locator("[data-landing-icon-edit]").first().click();
    await preview(page).getByRole("button", { name: "Shield", exact: true }).click();
    await preview(page).getByRole("button", { name: "Neutral", exact: true }).click();

    await expect(async () => {
      const features = await prismaTest.landingBlock.findFirst({ where: { type: "features" } });
      const data = features?.data as { items: { icon: string; tone: string }[] };
      expect(data.items[0].icon).toBe("Shield");
      expect(data.items[0].tone).toBe("neutral");
    }).toPass();
  });

  test("icon tones are shades of the brand accent, never free colours", async ({ seed, page }) => {
    await openEditor(page);
    await preview(page).locator("[data-landing-icon-edit]").first().click();

    // DESIGN.md forbids a second brand colour; the picker must offer the closed
    // set from ICON_TONES and nothing resembling a colour well.
    for (const tone of ["Akzent", "Akzent gedämpft", "Akzent hell", "Neutral", "Hell", "Dunkel"]) {
      await expect(preview(page).getByRole("button", { name: tone, exact: true })).toBeVisible();
    }
    await expect(preview(page).locator('input[type="color"]')).toHaveCount(0);
  });

  test("changing the background from the toolbar saves it", async ({ seed, page }) => {
    await openEditor(page);

    await blockToolbar(page, 1).getByRole("button", { name: "Hintergrund" }).click();
    await preview(page).getByRole("button", { name: "Dunkel" }).click();

    await expect(async () => {
      const features = await prismaTest.landingBlock.findFirst({ where: { type: "features" } });
      expect((features?.data as { background: string }).background).toBe("dark");
    }).toPass();
  });

  test("moving a block reorders the page", async ({ seed, page }) => {
    await openEditor(page);

    await blockToolbar(page, 1).getByRole("button", { name: "Block nach oben" }).click();

    await expect(async () => {
      const first = await prismaTest.landingBlock.findFirst({ orderBy: { position: "asc" } });
      expect(first?.type).toBe("features");
    }).toPass();
  });

  test("adding a block below inserts it there, not at the end", async ({ seed, page }) => {
    await openEditor(page);

    await blockToolbar(page, 0).getByRole("button", { name: "Block darunter einfügen" }).click();
    await preview(page).getByRole("button", { name: "Häufige Fragen" }).click();

    await expect(async () => {
      const all = await prismaTest.landingBlock.findMany({ orderBy: { position: "asc" } });
      expect(all.map((b) => b.type)).toEqual(["hero", "faq", "features", "steps", "order_form"]);
    }).toPass();
  });

  test("adding a block from the end bar appends it", async ({ seed, page }) => {
    await openEditor(page);

    await preview(page).getByTestId("landing-add-block").click();
    await preview(page).getByRole("button", { name: "Galerie" }).click();

    await expect(async () => {
      const all = await prismaTest.landingBlock.findMany({ orderBy: { position: "asc" } });
      expect(all[all.length - 1].type).toBe("gallery");
    }).toPass();
  });

  test("hiding a block from the toolbar takes it off the public page", async ({ seed, page }) => {
    await openEditor(page);

    await blockToolbar(page, 1).getByRole("button", { name: "Block ausblenden" }).click();

    await expect(async () => {
      const block = await prismaTest.landingBlock.findFirst({ where: { type: "features" } });
      expect(block?.visible).toBe(false);
    }).toPass();

    await publish(page);
    await page.goto("/");
    await expect(page.getByText("Kreativität trifft Technik")).toBeHidden();
    await expect(page.getByRole("heading", { name: /Deine Idee\./ })).toBeVisible();
  });

  test("deleting a block asks first", async ({ seed, page }) => {
    await openEditor(page);

    await blockToolbar(page, 2).getByRole("button", { name: "Block löschen" }).click();
    await preview(page).getByRole("button", { name: "Löschen", exact: true }).click();

    await expect(async () => {
      expect(await prismaTest.landingBlock.count({ where: { type: "steps" } })).toBe(0);
    }).toPass();
  });

  test("the order form offers no delete, only the lock", async ({ seed, page }) => {
    await openEditor(page);

    const bar = preview(page).locator('[data-landing-block]#order-form .landing-edit-chrome').first();
    // It owns the #order-form anchor the CTAs point at — hideable, not removable.
    await expect(bar.getByRole("button", { name: "Block löschen" })).toHaveCount(0);
    await expect(bar.getByRole("button", { name: "Block ausblenden" })).toBeVisible();
  });

  test("one add tile per list appends an entry; there is no per-card plus", async ({
    seed,
    page,
  }) => {
    await openEditor(page);

    const features = preview(page).locator('[data-landing-block]').nth(1);
    // One add affordance for the whole list, not one hovering over each card.
    await expect(features.getByTestId("landing-add-item")).toHaveCount(1);
    await expect(features.locator('.group').first().getByRole("button", { name: "Eintrag hinzufügen" })).toHaveCount(0);

    await features.getByTestId("landing-add-item").click();

    await expect(async () => {
      const block = await prismaTest.landingBlock.findFirst({ where: { type: "features" } });
      expect((block?.data as { items: unknown[] }).items).toHaveLength(5);
    }).toPass();
  });

  test("removing an entry from its own trash", async ({ seed, page }) => {
    await openEditor(page);

    const card = preview(page).locator('[data-landing-block]').nth(1).locator(".group").first();
    await card.getByRole("button", { name: "Eintrag entfernen" }).click();

    await expect(async () => {
      const block = await prismaTest.landingBlock.findFirst({ where: { type: "features" } });
      expect((block?.data as { items: unknown[] }).items).toHaveLength(3);
    }).toPass();
  });
});

test.describe("API validation", () => {
  test("GET lists every block, hidden ones included, in page order", async ({ seed, page }) => {
    await page.request.post("/api/admin/landing/init");
    const res = await page.request.get("/api/admin/landing");
    expect(res.ok()).toBeTruthy();
    const blocks = await res.json();
    expect(blocks.map((b: { type: string }) => b.type)).toEqual([
      "hero",
      "features",
      "steps",
      "order_form",
    ]);
  });

  test("rejects data that does not match the block's schema", async ({ seed, page }) => {
    const block = await createTestLandingBlock({ type: "richtext" });
    const res = await page.request.patch(`/api/admin/landing/${block.id}`, {
      data: { data: { background: "chartreuse", body: 42 } },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects an icon tone outside the curated set", async ({ seed, page }) => {
    await page.request.post("/api/admin/landing/init");
    const features = await prismaTest.landingBlock.findFirst({ where: { type: "features" } });
    const data = features!.data as { items: Record<string, unknown>[] };
    const res = await page.request.patch(`/api/admin/landing/${features!.id}`, {
      data: {
        data: {
          ...data,
          // A free colour would be a second brand colour — see DESIGN.md.
          items: [{ ...data.items[0], tone: "#ff00ff" }, ...data.items.slice(1)],
        },
      },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects an unknown block type", async ({ seed, page }) => {
    const res = await page.request.post("/api/admin/landing", {
      data: { type: "carousel_of_doom" },
    });
    expect(res.status()).toBe(400);
  });

  test("refuses a second hero", async ({ seed, page }) => {
    await page.request.post("/api/admin/landing/init");
    const res = await page.request.post("/api/admin/landing", { data: { type: "hero" } });
    expect(res.status()).toBe(400);
  });

  test("insert-below rejects an anchor that does not exist", async ({ seed, page }) => {
    const res = await page.request.post("/api/admin/landing", {
      data: { type: "faq", afterBlockId: "nope" },
    });
    expect(res.status()).toBe(404);
  });

  test("refuses to delete the order form, which owns the #order-form anchor", async ({
    seed,
    page,
  }) => {
    await page.request.post("/api/admin/landing/init");
    const orderForm = await prismaTest.landingBlock.findFirst({ where: { type: "order_form" } });
    const res = await page.request.delete(`/api/admin/landing/${orderForm!.id}`);
    expect(res.status()).toBe(400);
    expect(await prismaTest.landingBlock.count({ where: { type: "order_form" } })).toBe(1);
  });

  test("reorder rejects a partial page", async ({ seed, page }) => {
    await page.request.post("/api/admin/landing/init");
    const all = await prismaTest.landingBlock.findMany({ orderBy: { position: "asc" } });
    // Positions are only meaningful relative to each other — a subset would
    // silently leave gaps behind.
    const res = await page.request.post("/api/admin/landing/reorder", {
      data: { blockIds: [all[0].id, all[1].id] },
    });
    expect(res.status()).toBe(400);
  });

  test("a block whose data no longer parses is dropped from the page, not fatal", async ({
    seed,
    page,
  }) => {
    await createTestLandingBlock({ type: "richtext", position: 0, data: { nonsense: true } });
    // Publish the broken draft, then a visitor must still get a page: the bad
    // block is dropped from the snapshot, not rendered.
    await publish(page);
    const res = await page.request.get("/");
    expect(res.status()).toBe(200);
    await page.goto("/");
    await expect(page.locator("[data-landing-broken]")).toHaveCount(0);
  });

  test("a broken block is visible and deletable in the editor", async ({ seed, page }) => {
    // Dropping it here too would leave an admin unable to see or clean up a row
    // that exists and is broken — the whole reason parseBlock returns null.
    const broken = await createTestLandingBlock({
      type: "richtext",
      position: 0,
      data: { nonsense: true },
    });

    await page.goto("/admin/landing");
    const section = preview(page).locator("[data-landing-broken]");
    await expect(section).toBeVisible();
    await section.locator(".landing-edit-chrome").getByRole("button", { name: "Block löschen" }).click();
    await preview(page).getByRole("button", { name: "Löschen", exact: true }).click();

    await expect(async () => {
      expect(await prismaTest.landingBlock.count({ where: { id: broken.id } })).toBe(0);
    }).toPass();
  });
});

test.describe("image upload", () => {
  test("accepts a PNG and serves it publicly", async ({ seed, page }) => {
    // Smallest valid PNG — the route checks magic bytes, not just the extension.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const res = await page.request.post("/api/admin/uploads/landing", {
      multipart: { file: { name: "t.png", mimeType: "image/png", buffer: png } },
    });
    expect(res.ok()).toBeTruthy();
    const { url } = await res.json();
    expect(url).toMatch(/^\/api\/files\/landing\//);

    // Landing images are marketing material: reachable without a session.
    const anon = await page.request.get(url, { headers: { cookie: "" } });
    expect(anon.ok()).toBeTruthy();
  });

  test("rejects a file whose bytes are not the image it claims to be", async ({ seed, page }) => {
    const res = await page.request.post("/api/admin/uploads/landing", {
      multipart: {
        file: { name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<?php echo 1; ?>") },
      },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects an executable disguised by its extension", async ({ seed, page }) => {
    const res = await page.request.post("/api/admin/uploads/landing", {
      multipart: { file: { name: "x.exe", mimeType: "image/png", buffer: Buffer.from("MZ") } },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects an SVG carrying script", async ({ seed, page }) => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const res = await page.request.post("/api/admin/uploads/landing", {
      multipart: { file: { name: "x.svg", mimeType: "image/svg+xml", buffer: svg } },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("permissions", () => {
  test("a member without landing.edit is refused on every write route", async ({ seed, browser }) => {
    // landing.edit is deliberately absent from DEFAULT_ROLE_PERMISSIONS: the
    // feature is new, so it was never open to anyone but ADMIN.
    const role = await createTestTeamRole({ permissions: ["orders.edit"] });
    await createTestUser({ email: "kein-landing@example.com", teamRoleId: role.id });
    const block = await createTestLandingBlock();

    const { context, page } = await loginAs(browser, "kein-landing@example.com");

    expect((await page.request.post("/api/admin/landing", { data: { type: "faq" } })).status()).toBe(403);
    expect((await page.request.post("/api/admin/landing/init")).status()).toBe(403);
    expect((await page.request.post("/api/admin/landing/publish")).status()).toBe(403);
    expect((await page.request.post("/api/admin/landing/discard")).status()).toBe(403);
    expect(
      (await page.request.patch(`/api/admin/landing/${block.id}`, { data: { visible: false } })).status(),
    ).toBe(403);
    expect((await page.request.delete(`/api/admin/landing/${block.id}`)).status()).toBe(403);
    expect(
      (await page.request.post("/api/admin/landing/reorder", { data: { blockIds: [block.id] } })).status(),
    ).toBe(403);
    expect(
      (await page.request.post("/api/admin/uploads/landing", {
        multipart: { file: { name: "t.png", mimeType: "image/png", buffer: Buffer.from("x") } },
      })).status(),
    ).toBe(403);

    await context.close();
  });

  test("a member without landing.edit sees the page, read-only", async ({ seed, browser, page }) => {
    await page.request.post("/api/admin/landing/init");
    const role = await createTestTeamRole({ permissions: ["orders.edit"] });
    await createTestUser({ email: "nur-lesen@example.com", teamRoleId: role.id });

    const session = await loginAs(browser, "nur-lesen@example.com");
    await session.page.goto("/admin/landing");

    await expect(session.page.getByTestId("landing-readonly-banner")).toBeVisible();
    await expect(preview(session.page).locator("[data-landing-edit]")).toHaveCount(0);
    await session.context.close();
  });

  test("a member with landing.edit may edit", async ({ seed, browser }) => {
    const role = await createTestTeamRole({ permissions: ["landing.edit"] });
    await createTestUser({ email: "darf-landing@example.com", teamRoleId: role.id });

    const { context, page } = await loginAs(browser, "darf-landing@example.com");
    const res = await page.request.post("/api/admin/landing/init");
    expect(res.ok()).toBeTruthy();
    expect(await prismaTest.landingBlock.count()).toBe(4);
    await context.close();
  });
});

test.describe("bilingual content", () => {
  test("empty English falls back to German on the public page", async ({ seed, page }) => {
    await createTestLandingBlock({
      type: "richtext",
      position: 0,
      data: {
        background: "white",
        label: { de: "", en: "" },
        headline: { de: "Nur auf Deutsch", en: "" },
        body: { de: "Text", en: "" },
      },
    });

    await publish(page);
    await page.goto("/?preview_locale=en");
    await expect(page.getByText("Nur auf Deutsch")).toBeVisible();
  });

  test("English is used when it is filled in", async ({ seed, page }) => {
    await createTestLandingBlock({
      type: "richtext",
      position: 0,
      data: {
        background: "white",
        label: { de: "", en: "" },
        headline: { de: "Deutsche Fassung", en: "English version" },
        body: { de: "Text", en: "Text" },
      },
    });

    await publish(page);
    await page.goto("/?preview_locale=en");
    await expect(page.getByText("English version")).toBeVisible();
    await expect(page.getByText("Deutsche Fassung")).toBeHidden();
  });
});
