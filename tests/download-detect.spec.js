// Regression tests for ut-docs#1238 — the download page's primary-card
// detection offered "Raspberry Pi / ARM64" to a real Android tablet
// (Teclast P50T) because Chrome defaults to desktop site on large-screen
// Android tablets: the sync UA-string guess never sees "Android" (it reads
// as generic desktop Linux), and the Client Hints re-detect that then fires
// to recover the true architecture on Chromium's frozen UA (see
// site/download.html's own comment on that freezing) only asked for
// "architecture" — arm on a tablet and arm on a real Raspberry Pi look
// identical to that one signal.
//
// Real hardware confirmation is still open (ut-docs#1238: "the real tablet
// is in hand right now, so acceptance should include a check on it") — this
// suite exercises the fix's logic in a real browser via
// navigator.userAgentData/maxTouchPoints overrides, which is what's
// reachable from a cloud session with no physical device, not a substitute
// for that on-device check.
import { expect, test } from "@playwright/test";

// Chrome's frozen UA/platform for every non-Android Linux system, real CPU
// regardless — see site/download.html's Client Hints comment. Both the
// tablet-in-desktop-mode case and a genuine ARM Linux box present this.
const FROZEN_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const FROZEN_PLATFORM = "Linux x86_64";

async function gotoWithOverrides(page, { uaDataPlatform, uaDataArchitecture, maxTouchPoints }) {
  // Block the live GitHub Releases API call so this suite's assertions
  // depend only on the detect()/Client-Hints logic under test, not on
  // network reachability from wherever this runs.
  await page.route("https://api.github.com/**", (route) => route.abort());
  await page.addInitScript(
    ({ ua, platform, uaDataPlatform, uaDataArchitecture, maxTouchPoints }) => {
      Object.defineProperty(navigator, "userAgent", { get: () => ua, configurable: true });
      Object.defineProperty(navigator, "platform", { get: () => platform, configurable: true });
      Object.defineProperty(navigator, "maxTouchPoints", { get: () => maxTouchPoints, configurable: true });
      Object.defineProperty(navigator, "userAgentData", {
        get: () => ({
          getHighEntropyValues: () =>
            Promise.resolve({ architecture: uaDataArchitecture, platform: uaDataPlatform }),
        }),
        configurable: true,
      });
    },
    { ua: FROZEN_UA, platform: FROZEN_PLATFORM, uaDataPlatform, uaDataArchitecture, maxTouchPoints }
  );
  await page.goto("/download");
}

async function primaryCard(page) {
  // Client Hints re-detect resolves the (already-mocked, immediately
  // settled) getHighEntropyValues promise on a microtask — no fixed sleep
  // needed, but give the assertion its normal auto-retry against the final
  // state.
  await expect(page.locator("#primary")).toBeVisible();
  const href = await page.locator("#primary-link").getAttribute("href");
  const os = await page.locator("#primary-os").textContent();
  return { href, os };
}

test.describe("download page: Android tablet vs. Raspberry Pi/ARM Linux detection (ut-docs#1238)", () => {
  test("desktop-mode Android tablet with an honest platform hint -> Android, not Pi", async ({ page }) => {
    await gotoWithOverrides(page, { uaDataPlatform: "Android", uaDataArchitecture: "arm", maxTouchPoints: 5 });
    const { href } = await primaryCard(page);
    expect(href).toContain("universal-till/releases/latest");
  });

  test("desktop-mode Android tablet whose platform hint is ALSO spoofed to Linux -> maxTouchPoints tips it to Android", async ({ page }) => {
    await gotoWithOverrides(page, { uaDataPlatform: "Linux", uaDataArchitecture: "arm", maxTouchPoints: 5 });
    const { href } = await primaryCard(page);
    expect(href).toContain("universal-till/releases/latest");
  });

  test("no regression: a real ARM Linux box / Raspberry Pi (no touchscreen) still gets the Pi card", async ({ page }) => {
    await gotoWithOverrides(page, { uaDataPlatform: "Linux", uaDataArchitecture: "arm", maxTouchPoints: 0 });
    const { href } = await primaryCard(page);
    expect(href).toContain("linux_arm64.deb");
  });

  test("no regression: a real amd64 Linux desktop still gets the generic Linux card", async ({ page }) => {
    await gotoWithOverrides(page, { uaDataPlatform: "Linux", uaDataArchitecture: "x86", maxTouchPoints: 0 });
    const { href } = await primaryCard(page);
    expect(href).toContain("linux_amd64.deb");
  });
});
