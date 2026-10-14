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

async function gotoWithOverrides(page, { ua = FROZEN_UA, platform = FROZEN_PLATFORM, uaDataPlatform, uaDataArchitecture, uaDataBitness = "64", maxTouchPoints, release = null }) {
  // Block the live GitHub Releases API call (or answer it with a canned
  // release) so this suite's assertions depend only on the page's logic,
  // not on network reachability from wherever this runs.
  await page.route("https://api.github.com/**", (route) =>
    release ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(release) }) : route.abort());
  await page.addInitScript(
    ({ ua, platform, uaDataPlatform, uaDataArchitecture, uaDataBitness, maxTouchPoints }) => {
      Object.defineProperty(navigator, "userAgent", { get: () => ua, configurable: true });
      Object.defineProperty(navigator, "platform", { get: () => platform, configurable: true });
      Object.defineProperty(navigator, "maxTouchPoints", { get: () => maxTouchPoints, configurable: true });
      Object.defineProperty(navigator, "userAgentData", {
        get: () => ({
          getHighEntropyValues: () =>
            Promise.resolve({ architecture: uaDataArchitecture, platform: uaDataPlatform, bitness: uaDataBitness }),
        }),
        configurable: true,
      });
    },
    { ua, platform, uaDataPlatform, uaDataArchitecture, uaDataBitness, maxTouchPoints }
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
    expect(href).toContain("android-arm64.apk");
  });

  test("desktop-mode Android tablet whose platform hint is ALSO spoofed to Linux -> maxTouchPoints tips it to Android", async ({ page }) => {
    await gotoWithOverrides(page, { uaDataPlatform: "Linux", uaDataArchitecture: "arm", maxTouchPoints: 5 });
    const { href } = await primaryCard(page);
    expect(href).toContain("android-arm64.apk");
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

// ut-docs#1541: Android ships per-ABI APKs — arm64 (nearly every device),
// armv7 (older 32-bit) and a universal one. The primary card offers the
// device's own APK; the universal APK is the fallback whenever a release
// predates the split.
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const GH = "https://github.com/universaltill/universal-till/releases/download/v9.9.9/";
function release(names) {
  return { tag_name: "v9.9.9", assets: names.map((n) => ({ name: n, browser_download_url: GH + n })) };
}

test.describe("download page: Android per-ABI APK (ut-docs#1541)", () => {
  test("Android phone with a 64-bit hint -> arm64 APK", async ({ page }) => {
    await gotoWithOverrides(page, { ua: ANDROID_UA, platform: "Linux armv8l", uaDataPlatform: "Android", uaDataArchitecture: "arm", uaDataBitness: "64", maxTouchPoints: 5 });
    const { href } = await primaryCard(page);
    expect(href).toBe("/downloads/unitill-pos_android-arm64.apk");
  });

  test("Android phone reporting bitness 32 -> armv7 APK", async ({ page }) => {
    await gotoWithOverrides(page, { ua: ANDROID_UA, platform: "Linux armv8l", uaDataPlatform: "Android", uaDataArchitecture: "arm", uaDataBitness: "32", maxTouchPoints: 5 });
    await expect(page.locator("#primary-link")).toHaveAttribute("href", "/downloads/unitill-pos_android-armv7.apk");
  });

  test("desktop-mode tablet reporting bitness 32 -> armv7 APK", async ({ page }) => {
    await gotoWithOverrides(page, { uaDataPlatform: "Android", uaDataArchitecture: "arm", uaDataBitness: "32", maxTouchPoints: 5 });
    await expect(page.locator("#primary-link")).toHaveAttribute("href", /android-armv7\.apk$/);
  });

  test("live release WITH per-ABI assets -> primary and card links are the versioned per-ABI assets", async ({ page }) => {
    await gotoWithOverrides(page, {
      ua: ANDROID_UA, platform: "Linux armv8l", uaDataPlatform: "Android", uaDataArchitecture: "arm", maxTouchPoints: 5,
      release: release(["unitill-pos_9.9.9_android.apk", "unitill-pos_9.9.9_android-arm64.apk", "unitill-pos_9.9.9_android-armv7.apk"]),
    });
    await expect(page.locator("#primary-link")).toHaveAttribute("href", GH + "unitill-pos_9.9.9_android-arm64.apk");
    await expect(page.locator('a[data-dl="android-arm64"]')).toHaveAttribute("href", GH + "unitill-pos_9.9.9_android-arm64.apk");
    await expect(page.locator('a[data-dl="android-armv7"]')).toHaveAttribute("href", GH + "unitill-pos_9.9.9_android-armv7.apk");
    await expect(page.locator('a[data-dl="android"]')).toHaveAttribute("href", GH + "unitill-pos_9.9.9_android.apk");
  });

  test("live release WITHOUT per-ABI assets -> everything falls back to the universal APK", async ({ page }) => {
    await gotoWithOverrides(page, {
      ua: ANDROID_UA, platform: "Linux armv8l", uaDataPlatform: "Android", uaDataArchitecture: "arm", maxTouchPoints: 5,
      release: release(["unitill-pos_9.9.9_android.apk", "unitill-pos_9.9.9_linux_arm64.deb"]),
    });
    await expect(page.locator("#primary-link")).toHaveAttribute("href", GH + "unitill-pos_9.9.9_android.apk");
    await expect(page.locator('a[data-dl="android-arm64"]')).toHaveAttribute("href", GH + "unitill-pos_9.9.9_android.apk");
    await expect(page.locator('a[data-dl="android-armv7"]')).toHaveAttribute("href", GH + "unitill-pos_9.9.9_android.apk");
  });
});
