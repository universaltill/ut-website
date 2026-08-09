# 2026-08-09 — Fix the kiosk-setup path on the download page + guard documented paths

**Card:** universaltill/ut-docs#541
**Branch:** `fix/541-kiosk-setup-path`
**Model routing:** complexity:easy — built inline. Verified by running the guard
against both the broken and fixed states rather than by inspection.

## Why

The live download page told shop owners, for the flagship "dedicated Raspberry
Pi till" setup:

> after installing the `.deb`, run `sudo /opt/unitill/bin/unitill-kiosk-setup`
> and reboot

The package has never contained that path. Verified against the released
artifact:

```
$ ar p unitill-pos_0.2.73_linux_amd64.deb data.tar.gz | tar tzf - | grep kiosk
./usr/lib/unitill/unitill-kiosk-launch.sh
./usr/lib/unitill/unitill-kiosk-setup
```

`/opt/unitill/bin/` holds only `unitill-pos` and `unitill-desktop`. The
installed systemd unit agrees with the package, not the website:

```
ConditionPathExists=/usr/lib/unitill/unitill-kiosk-setup
ExecStart=/usr/lib/unitill/unitill-kiosk-setup --auto
```

So a shop owner following the site got `No such file or directory`, on the
configuration we most want to work, in all four locales, with no hint of the
real path. Found while setting up two real Raspberry Pi tills.

## What changed

- **`site/download.html`** — corrected the path in the `dl.next` copy.
- **`site/i18n.js`** — same correction in all four locales (`en-gb`, `tr-tr`,
  `zh-cn`, `fa-ir`). A translated copy of a wrong command is still wrong; the
  fix is worthless if only English is right.
- **`scripts/check-documented-paths.sh`** (new) — asserts every `/opt` or
  `/usr` path the site mentions actually exists in the current released `.deb`.
- **`.github/workflows/ci.yml`** — runs it as its own job.

## The guard, and why it checks the real artifact

The site and the packaging live in **different repos**, which is precisely why
this drift survived: neither repo's tests can see the other's truth, so no
amount of local checking would have caught it. The only honest check is against
the shipped package, so the script downloads the current release `.deb` and
greps its file list.

Deliberate choices:

- **Fails, rather than skips, when it cannot verify.** A guard that goes quietly
  green when the download fails reproduces the exact silent-pass problem it was
  written to prevent.
- **Basename hint on failure.** The first version dumped every `/opt` and `/usr`
  path in the package — hundreds of `web/ui/partials/*.html` lines that buried
  the answer. It now matches the missing file's basename and prints
  `did you mean: /usr/lib/unitill/unitill-kiosk-setup`, which is the realistic
  failure (a moved file) and an actionable message.
- **amd64 asset.** Both architectures ship an identical layout, so one is enough
  and it is the cheaper download.
- **`ar` + `tar` rather than `dpkg-deb`.** No dependency on dpkg being present.
- Requires at least two path segments, so a bare `/usr` mention in prose is not
  treated as a command.

## Verification

Both directions tested, not just the happy path:

| State | Expected | Result |
|---|---|---|
| Bug reintroduced in `download.html` | fail | **exit 1**, `MISSING /opt/unitill/bin/unitill-kiosk-setup` + `did you mean: /usr/lib/unitill/unitill-kiosk-setup` |
| Fixed | pass | **exit 0**, `All documented paths exist in the shipped package.` |

Repo checks all green afterwards:

- `scripts/check-i18n-keys.js` — OK (4 locales, 168 keys across 5 pages)
- `scripts/check-brand-assets.sh` — exit 0
- `scripts/check-swa-config.js` — OK
- `npm run build` — exit 0, 16 pages
- `site/` → `dist/` byte-for-byte copy — OK, and the corrected command is present
  in the built `dist/download.html`
- Every CI job is `runs-on: ubuntu-latest` — required on this **public** repo, since
  a self-hosted runner would let any fork's PR execute code in the homelab

## Not done here

`ut-docs#540` — the real fix is that a shop keeper should never type a terminal
command at all; the Pi needs a one-click installer like the Windows `.exe`.
This card only makes the current instruction true, which is worth doing on its
own because #540 will take a while and the page is broken now.
