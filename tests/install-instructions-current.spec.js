// ut-docs#3803: the download and start pages' install instructions drifted
// from what the shipped packages actually do.
//
// 1. macOS: the copy said "right-click → Open" to get past the unsigned-app
//    warning. Since macOS 15 that override no longer exists — an unsigned
//    download is unblocked via System Settings → Privacy & Security →
//    Open Anyway. And the .dmg is Developer ID signed + notarized now
//    (verified 2026-10-11 on v0.31.8 with `spctl -a -vvv` → "Notarized
//    Developer ID"), so it needs no workaround at all; only the portable
//    .tar.gz (unsigned run-unitill.command) still does.
// 2. Raspberry Pi: the copy told Pi users to run unitill-kiosk-setup by
//    hand, but a fresh install on Pi OS Lite stages the kiosk on first boot
//    and Pi OS with Desktop gets a fullscreen overlay (universal-till
//    README, "Raspberry Pi").
//
// Source scan of everything that ships (site/ is copied into dist/
// byte-for-byte; src/ renders the Astro pages), plus per-locale checks that
// the replacement instructions are present in every language.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(html|js|json|astro|ts|mdx|md)$/.test(e.name) ? [p] : [];
  });
}

const SHIPPED_FILES = [...walk(path.join(ROOT, "site")), ...walk(path.join(ROOT, "src"))];

function loadI18N() {
  const src = fs.readFileSync(path.join(ROOT, "site", "i18n.js"), "utf8");
  const m = src.match(/const I18N = (\{[\s\S]*?\});\s*\n\s*\(function/);
  if (!m) throw new Error("could not locate the I18N object literal in site/i18n.js");
  return (0, eval)("(" + m[1] + ")");
}

// The "right-click → Open" instruction in each launch language, plus the
// manual kiosk step. Patterns are the wording the stale copy actually used.
const STALE = [
  { name: "EN right-click → Open", re: /right-click[^.]{0,40}\bOpen\b/i },
  { name: "DE Rechtsklick → Öffnen", re: /(Rechtsklick|rechten Maustaste)[^.]{0,60}Öffnen/i },
  { name: "TR sağ tıklayıp Aç", re: /sağ tık[^.]{0,40}Aç/i },
  { name: "ZH 右键…打开", re: /右键[^。]{0,20}打开/ },
  { name: "FA راست‌کلیک … Open", re: /راست[‌\s]?کلیک[^.]{0,60}(Open|باز)/ },
];

// The manual kiosk command is banned from the install steps only (the
// download/start pages' copy), not site-wide: it stays the right advice for
// an older Pi upgraded in place (universal-till README), should a page ever
// need to say so.
const INSTALL_STEP_KEY = /^(dl\.|start\.)/;
const INSTALL_STEP_PAGES = ["site/download.html", "site/start.html"];

// macOS's own labels per language (read from macOS 27's
// SecurityPrivacyExtension loctables, 2026-10-11). macOS ships no Persian
// UI, so the FA copy names the English labels.
const OPEN_ANYWAY = {
  "en-gb": "Open Anyway",
  "de-de": "Dennoch öffnen",
  "tr-tr": "Yine de Aç",
  "zh-cn": "仍要打开",
  "fa-ir": "Open Anyway",
};

test.describe("install instructions match the shipped packages (ut-docs#3803)", () => {
  test("no install step tells Pi users to run unitill-kiosk-setup by hand", () => {
    const hits = INSTALL_STEP_PAGES.filter((f) =>
      fs.readFileSync(path.join(ROOT, f), "utf8").includes("unitill-kiosk-setup"));
    for (const [lang, dict] of Object.entries(loadI18N())) {
      for (const [key, val] of Object.entries(dict)) {
        if (INSTALL_STEP_KEY.test(key) && String(val).includes("unitill-kiosk-setup")) hits.push(`${lang} ${key}`);
      }
    }
    expect(hits).toEqual([]);
  });

  test("no stale right-click → Open step ships", () => {
    const hits = [];
    for (const file of SHIPPED_FILES) {
      const text = fs.readFileSync(file, "utf8");
      for (const { name, re } of STALE) {
        if (re.test(text)) hits.push(`${path.relative(ROOT, file)}: ${name}`);
      }
    }
    expect(hits).toEqual([]);
  });

  const I18N = loadI18N();

  test("every launch locale is covered", () => {
    expect(Object.keys(I18N).sort()).toEqual(Object.keys(OPEN_ANYWAY).sort());
  });

  for (const [lang, label] of Object.entries(OPEN_ANYWAY)) {
    test(`${lang}: portable macOS step names Privacy & Security → ${label}`, () => {
      expect(I18N[lang]["start.mac.2"]).toContain(label);
    });

    test(`${lang}: download next-steps match the packages`, () => {
      const next = I18N[lang]["dl.next"];
      // Open Anyway appears once: for the un-notarized portable archive's
      // run-unitill.command only, never as a step for the notarized .dmg.
      expect(next.split(label).length - 1).toBe(1);
      expect(next).toMatch(new RegExp(`run-unitill\\.command</code>[^<]*${label}`));
      // The Pi OS Lite first-boot kiosk is described instead of a command.
      expect(next).toContain("Raspberry Pi OS Lite");
      expect(next).toContain("Raspberry Pi OS with Desktop");
    });
  }
});
