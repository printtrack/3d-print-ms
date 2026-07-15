import { test, expect } from "../fixtures/test-base";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  DEFAULT_ROLE_PERMISSIONS,
} from "../../lib/permissions";
import de from "../../messages/de.json";
import en from "../../messages/en.json";

// Guards the permission registry itself. A permission with no label renders as a
// blank checkbox in the role editor, and a key that exists in only one language
// silently breaks that language — neither shows up in a functional test.

const messages: Record<string, Record<string, string>> = {
  de: de.admin as Record<string, string>,
  en: en.admin as Record<string, string>,
};

test.describe("permission registry", () => {
  test("permission keys are unique", () => {
    const keys = PERMISSIONS.map((p) => p.key);
    expect(keys).toHaveLength(new Set(keys).size);
  });

  test("every permission belongs to a declared group", () => {
    for (const p of PERMISSIONS) {
      expect(PERMISSION_GROUPS, `${p.key} has an unknown group`).toContain(p.group);
    }
  });

  test("every group has at least one permission", () => {
    for (const group of PERMISSION_GROUPS) {
      const inGroup = PERMISSIONS.filter((p) => p.group === group);
      expect(inGroup.length, `group ${group} is empty`).toBeGreaterThan(0);
    }
  });

  for (const locale of ["de", "en"] as const) {
    test(`every permission has a label and description in ${locale}`, () => {
      const missing: string[] = [];
      for (const p of PERMISSIONS) {
        const base = `perm_${p.key.replace(/\./g, "_")}`;
        if (!messages[locale][`${base}_label`]) missing.push(`${base}_label`);
        if (!messages[locale][`${base}_desc`]) missing.push(`${base}_desc`);
      }
      expect(missing).toEqual([]);
    });

    test(`every permission group has a label in ${locale}`, () => {
      const missing = PERMISSION_GROUPS.filter(
        (g) => !messages[locale][`perm_group_${g}`],
      );
      expect(missing).toEqual([]);
    });
  }

  test("the default role only grants keys that exist in the registry", () => {
    const known = new Set(PERMISSIONS.map((p) => p.key));
    const unknown = DEFAULT_ROLE_PERMISSIONS.filter((k) => !known.has(k));
    expect(unknown).toEqual([]);
  });

  test("the default role withholds every destructive permission it should", () => {
    // Mirrors what a TEAM_MEMBER could NOT do before roles existed. If one of
    // these creeps into the default set, the migration silently widens access
    // for every existing member.
    const mustNotHave = [
      "orders.delete",
      "knowledge.delete",
      "inventory.edit",
      "inventory.delete",
    ];
    for (const key of mustNotHave) {
      expect(DEFAULT_ROLE_PERMISSIONS, `${key} must stay admin-only`).not.toContain(key);
    }
  });

  test("the seeded system role matches DEFAULT_ROLE_PERMISSIONS", async ({ seed }) => {
    const seeded = seed.defaultRole.permissions.map((p) => p.key).sort();
    expect(seeded).toEqual([...DEFAULT_ROLE_PERMISSIONS].sort());
    expect(seed.defaultRole.isSystem).toBe(true);
    expect(seed.defaultRole.isDefault).toBe(true);
    expect(seed.defaultRole.restricted).toBe(false);
  });
});
