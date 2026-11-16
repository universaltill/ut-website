# Review: public help pages (ut-docs#5355, part of #4504)

Reviewer: independent Opus sub-agent (author: Sonnet 5.5). Tester: separate
sub-agent, driven run in Chromium. Design critique: separate sub-agent (static
mock, Figma not used - no file).

## Findings and disposition

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | MAJOR | Release-API failure silently fell back to `main`, publishing unreleased docs on the hourly deploy | Fixed: `resolveRef` -> release API, then `git ls-remote` highest tag; `main` only outside CI; CI fails |
| 2 | MAJOR | Upstream rename / `public:false` / odd front-matter / bad image would fail the whole site deploy | Fixed: allow-list advisory, guard + tests read the build manifest, bad topic/image skipped with warning |
| 3 | owner | Public topics (sell, display, users, reports) still describe DE TSE / fiskaly / TR fiscal features whose own topics are excluded | Open - owner decision recorded in the PR |
| 4 | MINOR | `public: "false"` etc. ignored | Fixed: only unquoted true/false accepted, else not public |
| 5 | MINOR | quoted commas in list front-matter | Fixed |
| 6 | MINOR | slug not validated | Fixed (`[a-z0-9-]+`) |
| 7 | MINOR | `$` replacement bug (title, search query) | Fixed (function replacer) |
| 8 | MINOR | notice language name | Fixed (language subtag) |
| 9 | MINOR | HELP_REF wording | Fixed in README |
| 10 | MINOR | workflow token hygiene | Fixed: `permissions: contents: read`, token only on build step |
| 11 | MINOR | guard/test gaps (hostile markdown cases, `title:` leak) | Fixed |
| T1 | minor | de/tr/fa inventory step 5 English in product source | Not ours; noted on PR |
| T3 | minor | mobile breadcrumb separator alone on a line | Fixed (separator on previous item) |
| T4 | note | zh-cn index has no page-level fallback notice (cards marked lang=en) | Accepted |

## Verified by the reviewer
No XSS/path traversal: raw HTML dropped, only `#`, https, mailto and public
help links survive, git called via execFileSync arg arrays, PNG magic + size
checks, canonical/hreflang/sitemap per ut-docs#3811, RTL fallback wrapping.
