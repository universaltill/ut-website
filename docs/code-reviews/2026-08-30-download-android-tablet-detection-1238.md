# 2026-08-30 — ut-docs#1238: download page misdetects an Android tablet as Raspberry Pi / ARM64

**Card:** [ut-docs#1238](https://github.com/universaltill/ut-docs/issues/1238)
**Complexity:** easy — **Build model:** Sonnet (inline) — **Review model:** Sonnet, fresh-context worktree-isolated subagent

## What shipped

`site/download.html`'s primary-card auto-detect offered a Raspberry Pi
`.deb` to a real Android tablet (Teclast P50T, Android 16, Chrome),
confirmed on real hardware. Root cause: Chrome defaults to desktop site on
large-screen Android tablets, so the sync `navigator.userAgent` check never
sees "Android" and falls through to a generic Linux guess; the existing
Client Hints re-detect (added earlier to recover the true CPU architecture
on Chromium's frozen `"Linux x86_64"` UA string) then requested only
`architecture`, got `"arm"`, and flipped the guess to Pi — an ARM tablet and
a real ARM Linux box are indistinguishable to that one signal alone. A
follow-up comment on the ticket noted the misdetection is nondeterministic
across page loads on the same tablet.

Fix: the Client Hints re-detect now also requests `platform`, and routes
`platform === "Android"` to the Android card before the arm→Pi branch
(this is the authoritative case — the honest signal wins outright). For the
case where desktop-mode Chrome might spoof `platform` to `"Linux"` too
(unconfirmed either way on real hardware — no device in hand to check),
`navigator.maxTouchPoints > 1` is used as a secondary signal: an ARM
"Linux" report from a multi-touch device is treated as a tablet rather than
silently defaulting to Pi. `androidResult()` was factored out so both the
sync detect() and the async re-detect describe "Android" identically.

## Independent review

Fresh-context Sonnet subagent (worktree-isolated), per this card's
`complexity:easy` routing. Traced the branch precedence by hand and
confirmed by test: honest `platform==="Android"` → Android (wins first) →
`arm` + `maxTouchPoints>1` → Android → `arm` alone → Pi (unchanged) → no
match → generic Linux (unchanged). Confirmed `androidResult()` is
byte-identical to the inline object literal it replaced.

**One non-blocking finding, not fixed in this branch — filed as a follow-up
card:** the `maxTouchPoints > 1` tiebreaker can't distinguish a desktop-mode
Android tablet from a real Raspberry Pi fitted with the official multi-touch
touchscreen (a hardware config this product explicitly targets — kiosk Pi +
touchscreen till). A shop owner opening `/download` in the Pi's own browser
before kiosk mode is configured would now get routed to the Android `.apk`
instead of the Pi `.deb` — the mirror image of the bug just fixed, on a
narrower but real case. This is the exact tradeoff the ticket itself
proposed and accepted, not a deviation from spec, and strictly improves on
the status quo (the tablet case was 100% broken before this fix; the
touchscreen-Pi case was already imperfect, since a real Pi with no
touchscreen was already routed correctly and one *with* a touchscreen was
never previously distinguished from a tablet either — Client Hints'
`architecture` alone can't do that). Filed as
[ut-docs#1305](https://github.com/universaltill/ut-docs/issues/1305)
recommending a `formFactor` Client Hint, where supported, as a stronger
signal than touch points. Not a blocker —
this is a real, separate future improvement, not a defect in what shipped.

One minor, non-blocking observation not requiring a code change:
`getHighEntropyValues(["architecture", "platform"])` requests `"platform"`
as a high-entropy hint even though it's already available synchronously as
`navigator.userAgentData.platform`; harmless (browsers ignore redundant
hint keys) and left as-is for symmetry with `architecture` in the same
call, rather than splitting the check across a sync read and an async one.

## What was verified beyond automated tests

- `npm run build`, `node scripts/generate-csp.js --check` (CSP hash
  regenerated via `--write` after editing the inline script; confirmed
  up to date against the built output) — both green.
- `npx playwright test` — full suite, **133 passed**, no regressions
  (includes `tests/csp.spec.js`'s zero-violation sweep, which
  independently corroborates the regenerated CSP hash is correct).
- New regression suite `tests/download-detect.spec.js` (4 tests, via
  `navigator.userAgentData`/`maxTouchPoints` overrides in a real browser —
  the reachable equivalent from a cloud session with no physical device):
  honest Android platform hint → Android; spoofed-to-Linux platform hint +
  multi-touch → Android; real ARM Linux/Pi (no touch) → Pi, unchanged;
  real amd64 Linux → generic Linux card, unchanged.
- TDD claim independently re-verified twice (once by the implementer,
  once by the reviewer): reverting `site/download.html` (and its CSP hash
  in lockstep, since an unregenerated hash blocks the whole inline script
  and produces a false-negative for the wrong reason) makes exactly the
  two Android-tablet tests fail — reproducing the original bug — while the
  two no-regression tests keep passing; restoring returns all four to
  green. Reviewer confirmed the restored files are byte-identical to the
  fix branch (`git diff` empty) and reran the full suite once more (133
  passed) after restoring.
- No real client/shop name or secret-shaped literal anywhere in the diff.

## Explicitly deferred

- **Follow-up card** (see above): a `formFactor` Client Hint, or another
  stronger signal, to stop `maxTouchPoints > 1` from misrouting a real
  Raspberry Pi fitted with a multi-touch touchscreen to the Android card.
- **Real-hardware confirmation still open**, per the original ticket's own
  acceptance criteria — this fix could not be checked on the reporting
  Teclast P50T tablet from this session; someone with the device in hand
  should confirm before treating ut-docs#1238 as fully closed rather than
  just "fixed and reviewed."

**Verdict: safe to merge.** No blocking findings; both non-blocking items
above are either filed as a separate card or left as a documented,
deliberate non-issue.
