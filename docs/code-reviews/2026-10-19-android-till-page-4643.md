# 2026-10-19 — Android till landing page (ut-docs#4643)

**Author:** lane:cloud-41 (Opus 5.5). **Reviewer:** an independent Fable subagent, one round (MODEL-ROUTING: complexity:medium).

## What shipped
- A new page at `/<locale>/android-till` in en-gb, tr-tr, zh-cn, fa-ir and de-de. It comes from the `site/android-till.html` template, with routes in `staticwebapp.config.json`, so the prerender, sitemap, hreflang and llms.txt pick it up on their own. `/android-till` and `/android-till.html` redirect (301) to `/en-gb/android-till`, the same way `/pilot` does.
- Each locale has its own title and meta description with the search phrase. These are the owner's terms: en "Android till", de "Kassensystem für Android / Kassen-App", tr "Android POS" plus "adisyon" in the description. Titles are at most 60 characters and descriptions at most 160. `seo-prerender.spec.js`'s length test now covers this page too.
- The page content covers what runs on an Android tablet, the three setup steps, the limits ("Good to know") and four FAQ entries specific to Android. Every claim was checked against universal-till: `android/README.md`, the help topics `bluetooth-devices`, `display`, `multitill`, `updates` and `sell`, the `setup.*` keys, `build.gradle.kts` minSdk 24, and `download.html`.
- `marketingPages.ts` has two changes:
  - `faqJsonLd` also accepts a FAQ namespaced to its page (`android.faq.qN`). The home page output is unchanged.
  - A new `softwareJsonLd` adds a `SoftwareApplication` block for templates that declare `<meta name="ut:software-os">`. The block's description is the page's own translated meta description.
- New links point to the page from the home hardware section (`hw.androidlink`) and the download page's Android card (`dl.android.about`).
- There are 43 new keys in each of the five locales, plus a README entry.
- Tests: `tests/android-till-page.spec.js` (19 tests).

## Findings (Fable)
| # | Severity | Finding | Outcome |
|---|---|---|---|
| 1 | major | The page said self-order "pins the screen so they can't leave the app". That is untrue without Device Owner provisioning: the pin needs Android's prompt accepted, and the unpin gesture still works | **Fixed** in all 5 locales. The page now says the pin "blocks Home and Recents while it stays pinned". A new "Good to know" item explains the standard pin and that a managed device is needed for a lock that can't be undone (Device Owner is supported: `MainActivity.kt` `isDeviceOwnerApp`/`setLockTaskPackages`) |
| 2 | major | Two of the four FAQ entries repeated the home FAQ, which is doorway and duplicate-FAQPage risk | **Fixed.** They are replaced by Android-specific questions: Wi-Fi or mobile data, and mixing with Windows or Pi tills. The test now fails if any question matches a home FAQ question (checked: it fails with the old wording) |
| 3 | major | Titles and descriptions were over the site's 60/160 rule (tr/de/fa) | **Fixed.** All are shortened, and the length test covers `android-till` |
| 4 | minor | The "distinct from home" check could never fail (`<title data-i18n=…>`), and the H1 check only looked at the first word | **Fixed.** The test now compares the extracted title and description and checks the full phrase in the H1 |
| 5 | minor | "Updates in two taps" ignored the first-time permission prompt | **Fixed.** The heading is now "Updates from inside the till", and the text mentions the first-time prompt |
| 6 | minor | The "Getting started" button led to `/start`, which has no Android content | **Fixed.** The button is now "How to set it up" → `#setup` on this page |
| 7 | nit | SoftwareApplication uses priceCurrency GBP on every locale; no downloadUrl | Accepted. Price 0 makes the currency moot |
| 8 | nit | The FAQ prefix regex allowed only one `[a-z]` segment | **Fixed.** It is now `(?:[a-z0-9-]+\.)*faq` |
| 9 | nit | The screenshot is the generic sale screen | Accepted. The alt text says honestly that it is the same screen on every till. A real tablet capture is a follow-up |
| 10 | nit | Awkward Turkish button phrasing in setup step 2 | **Fixed:** «Uygulamayı tara»ya, ardından «Yükle»ye |

## Verified beyond automated tests
- I looked at screenshots of en-gb at 1350 px and 390 px, fa-ir at 390 px (RTL) and de-de at 1350 px. None has horizontal scroll (scrollWidth equals the viewport), and the layout matches the home page.
- The reviewer independently traced every claim on the page to its source in universal-till (see the table above).
- The gate passes:
  - Full Playwright suite: 372/372.
  - `check-i18n-keys`, `check-swa-config` (+ test), compliance claims (+ test), brand assets, documented paths, download redirects, `plugins_test`, `translate-posts`: all OK.
  - `generate-csp --check`: OK, with no new inline scripts.

## Deferred (filed as cards)
- Other platform pages: Windows EPOS, Raspberry Pi till, free EPOS / till system, offline till, and iPhone/iPad once the App Store build is public. Each one must be distinct, not a copy of this page.
- A real Android tablet screenshot for this page.
- Search Console: submit the page and record the baseline positions for "android till", "android epos" and "till android". This needs the owner's access.

## Verdict
Safe to merge.
