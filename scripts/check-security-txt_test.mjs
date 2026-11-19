// Tests for check-security-txt.mjs (ut-docs#5318, RFC 9116).
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "./check-security-txt.mjs";

const NOW = new Date("2026-11-04T00:00:00Z");
const good = [
  "Contact: mailto:security@universaltill.com",
  "Expires: 2027-05-01T00:00:00.000Z",
  "Preferred-Languages: en, de, tr",
  "Canonical: https://www.universaltill.com/.well-known/security.txt",
  "",
].join("\n");
const errs = (t) => validate(t, NOW);

test("a good file passes", () => assert.deepEqual(errs(good), []));
test("missing Contact fails", () => assert.ok(errs(good.replace(/Contact.*\n/, "")).length));
test("Contact must be security@", () =>
  assert.ok(errs(good.replace("security@", "hello@")).length));
test("missing Expires fails", () => assert.ok(errs(good.replace(/Expires.*\n/, "")).length));
test("missing Canonical fails", () => assert.ok(errs(good.replace(/Canonical.*\n/, "")).length));
test("expired fails", () => assert.ok(errs(good.replace("2027-05-01", "2026-10-01")).length));
test("expiring within 60 days fails", () =>
  assert.ok(errs(good.replace("2027-05-01", "2026-12-15")).length));
test("more than a year away fails", () =>
  assert.ok(errs(good.replace("2027-05-01", "2028-01-01")).length));
test("invalid date fails", () => assert.ok(errs(good.replace("2027-05-01T00:00:00.000Z", "soon")).length));
test("BOM fails", () => assert.ok(errs("﻿" + good).length));
test("no trailing newline fails", () => assert.ok(errs(good.trimEnd()).length));
test("duplicate Expires fails", () => assert.ok(errs(good + "Expires: 2027-05-01T00:00:00Z\n").length));
test("canonical must be https www", () =>
  assert.ok(errs(good.replace("https://www.", "http://www.")).length));

test("the shipped file and SWA config pass", async () => {
  const { checkRepo } = await import("./check-security-txt.mjs");
  assert.deepEqual(checkRepo(NOW), []);
});
