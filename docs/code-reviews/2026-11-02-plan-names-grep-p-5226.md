# Review: guard-plan-names fails loudly without grep -P (ut-docs#5226)

- Author model: Sonnet 5.5. Reviewer: Opus 5.5 (fresh context, one round).
- Change: `scripts/guard-plan-names.sh` probes `grep -P` with the real pattern
  (`GREP` override, `ggrep` preferred) and exits 2 with a "needs GNU grep" hint;
  a grep exit code above 1 during the scan also exits 2 (it used to be hidden
  by `|| true`). `PATTERN` and the allow marker are unchanged.
- Tests: three new cases in `guard-plan-names_test.sh` (grep without `-P`,
  asserting exit 2 and message; grep that passes the probe and fails mid-scan;
  existing cases unchanged). The first fails against the old guard.

## Findings
1. Medium, fixed: `|| true` hid grep errors during the scan. Now only exit 1 means no match.
2. Low, fixed: the probe uses the real pattern.
3. Low, declined: the `GREP` name is kept (the card asks for a `GREP` override, as in guard-plan-prices.sh); the error names the binary.
4. Nit, fixed: the test asserts exit code 2.
5. Nit, pre-existing: `LC_ALL=C.UTF-8` on macOS, harmless for an ASCII pattern.

`shellcheck` was not available in the container. Sibling check: only
`guard-plan-prices.sh` also uses `-P` and it already fails loudly.
