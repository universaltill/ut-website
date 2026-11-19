// ut-docs#6278: since 2026-09-30 the UK data protection regulator is the
// Information Commission (Data (Use and Access) Act 2025 ss.117-119,
// SI 2026/1015). "Information Commissioner('s Office)" is the abolished
// predecessor and may appear in the legal pages only as a "formerly ..." bridge
// (kept 12 months, until 2027-09-30). Source-level check over every legal page.
import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const ROOT = fileURLToPath(new URL("../src/content/legal/", import.meta.url));

function mdxFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? mdxFiles(join(dir, e.name)) : /\.mdx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

// Only the exact bridge phrase is allowed (either apostrophe, any case); it is
// removed first, then any remaining old-name fragment is a failure.
const BRIDGE = /formerly the Information Commissioner['’]s Office/gi;
const OLD_NAME = /Information Commissioner|Commissioner['’]s Office/gi;
function oldNameHits(raw) {
  // Collapse newlines so a phrase wrapped over two lines still matches.
  const text = raw.replace(/\s+/g, " ").replace(BRIDGE, "");
  return [...text.matchAll(OLD_NAME)].map((m) => text.slice(Math.max(0, m.index - 60), m.index + 40));
}

test.describe("legal pages name the UK regulator correctly (ut-docs#6278)", () => {
  const files = mdxFiles(ROOT);
  test("the matcher flags the old name outside the bridge", () => {
    expect(oldNameHits("complain to the information commissioner's office")).toHaveLength(1);
    expect(oldNameHits("complain to the Commissioner's Office")).toHaveLength(1);
    expect(oldNameHits("the Commissioner’s Office")).toHaveLength(1);
    expect(oldNameHits("was formerly called X. Information Commissioner's Office")).toHaveLength(1);
    expect(oldNameHits("Information Commission (formerly the Information\nCommissioner's Office)")).toEqual([]);
    expect(oldNameHits("(Formerly the Information Commissioner’s Office)")).toEqual([]);
  });
  test("there are legal pages to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });
  for (const file of files) {
    test(`${relative(ROOT, file)}: old regulator name only after "formerly"`, () => {
      const bad = oldNameHits(readFileSync(file, "utf8"));
      expect(bad, 'use "Information Commission"; the old name only as "(formerly the Information Commissioner\'s Office)"').toEqual([]);
    });
  }
});
