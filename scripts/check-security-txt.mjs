#!/usr/bin/env node
// RFC 9116 check for site/.well-known/security.txt (ut-docs#5318).
// Fails when the file is malformed, or Expires is less than 60 days away (so
// CI reminds us to renew it) or more than a year away (RFC 9116: <1 year).
// Also asserts the SWA config has no route touching /.well-known.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DAY = 86_400_000;

export function validate(text, now = new Date()) {
  const errors = [];
  if (text.charCodeAt(0) === 0xfeff) errors.push("file starts with a BOM");
  if (!text.endsWith("\n")) errors.push("file must end with a newline");
  const fields = {};
  for (const line of text.split("\n")) {
    const m = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (m) (fields[m[1].toLowerCase()] ??= []).push(m[2].trim());
  }
  const one = (k) => {
    const v = fields[k.toLowerCase()] ?? [];
    if (v.length !== 1) errors.push(`${k} must appear exactly once (found ${v.length})`);
    return v[0];
  };
  const contact = one("Contact");
  if (contact !== undefined && contact !== "mailto:security@universaltill.com")
    errors.push("Contact must be mailto:security@universaltill.com");
  const expires = one("Expires");
  if (expires !== undefined) {
    const d = new Date(expires);
    if (!/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/i.test(expires) || Number.isNaN(d.getTime())) {
      errors.push(`Expires is not an ISO 8601 date-time: ${expires}`);
    } else {
      const days = (d - now) / DAY;
      if (days < 60) errors.push(`Expires is ${Math.floor(days)} days away (< 60): renew security.txt`);
      if (days > 366) errors.push("Expires is more than a year away (RFC 9116)");
    }
  }
  const canonical = one("Canonical");
  if (canonical !== undefined && canonical !== "https://www.universaltill.com/.well-known/security.txt")
    errors.push("Canonical must be https://www.universaltill.com/.well-known/security.txt");
  return errors;
}

export function checkRepo(now = new Date()) {
  const errors = validate(fs.readFileSync(path.join(root, "site/.well-known/security.txt"), "utf8"), now);
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "site/staticwebapp.config.json"), "utf8"));
  for (const r of cfg.routes ?? []) {
    if (r.route.startsWith("/.well-known")) errors.push(`SWA route touches /.well-known: ${r.route}`);
  }
  if (cfg.navigationFallback)
    errors.push("navigationFallback exists: re-verify /.well-known/security.txt is excluded");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = checkRepo();
  if (errors.length) {
    for (const e of errors) console.error(`check-security-txt: ${e}`);
    process.exit(1);
  }
  console.log("✓ check-security-txt: security.txt valid");
}
