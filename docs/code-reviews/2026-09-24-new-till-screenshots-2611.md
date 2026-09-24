# 2026-09-24: home page screenshots show the current till and my.universaltill.com (ut-docs#2611, website slice)

**Change.**
- The home page's hero, tour gallery and hardware images are replaced with WebP captures of the current till (v0.21.4).
- The pictures were taken on a throwaway local till: seeded demo catalogue, 34 demo sales rung through the UI, strip-with-quick-buttons mode for the hero, category-tiles mode at 1024×600 for the hardware section, and `?lang=fa` for the multilingual shot.
- A new `#manage` section shows the Manage shop app (my.universaltill.com). It was rendered from `ut-my-shop` `origin/main` in a scratch worktree, with its `/ui/app/*` API calls answered by sample data ("Corner Café"); the caption says so.
- The 12 unused PNGs were removed (images 2.3 MB → 728 KB).
- `plugin-store.png` stays: the current store shows every official plugin as "Unverified" on an unregistered till, which contradicts the caption (filed as ut-docs#2647).
- New `data-i18n-alt` hook in `site/i18n.js`: an image's alt reuses its caption key, so alt text follows the page language. `manage.*` strings were added in all 5 locales.

**Tests.**
- `tests/home-screenshots.spec.js`: on every locale, every home-page image loads, has alt text, and a translated alt equals its caption. Verified to fail with the hook disabled (tr/zh/fa/de all fail).
- Full suite: 174 passed.

**Review.** Independent review by a different-model subagent (Sonnet), read-only:
1. `check-i18n-keys.js` didn't scan `data-i18n-alt`. **Fixed** by extending the regex; verified that a missing alt key now fails the check.
2. `#manage` has no nav link. **Deliberately not done:** the nav is shared by all 11 pages (`site-consistency.spec.js` fingerprints it) and is already full; the section is reached by scrolling between Tour and Hardware.

Otherwise clean:
- No other references to the deleted PNGs.
- `.webp` is served correctly (serve-site maps it; SWA serves by extension).
- width/height match the real pixel sizes.
- The images contain only demo/sample data: no real names, emails, tokens, hostnames or IPs.
- The fa strings use Persian ی/ک.

**Exposure.** No new data. All screens show demo or sample data. The version label v0.21.4 is public anyway.
