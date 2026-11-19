// Publish gate for the partner privacy notice (ut-docs#6277 item 2).
//
// The page at /en-gb/partner-privacy/ is built ONLY while this is true. It is
// OFF on purpose: the text is a DRAFT (ut-docs reference/
// partner-support-contact-notices-draft.md) and its retention and "stop showing
// it while we look" sentences are promises the product keeps only once
// ut-docs#6275 and #6276 have shipped.
//
// To go live (a reviewed one-line change, the owner's OK on the text named in
// the PR): set the constant to true AND remove the DRAFT comment from
// src/content/partner-notice/en-gb/partner-privacy.mdx (a test enforces it).
// Conditions: owner OK on the text, #6275 and #6276 shipped, #6278 settled or
// the neutral regulator phrase kept, partner agreement clause 10A.
// Order: this site first, then the partner app's PARTNER_PRIVACY_URL variable.
export const PARTNER_PRIVACY_PAGE_LIVE = false;

// Path under /{lang}. The partner app pins the same string in its tests.
export const PARTNER_PRIVACY_PATH = '/partner-privacy/';

// UT_PARTNER_PRIVACY_PAGE=on is honoured only for fixture builds (UT_OUT_DIR
// set, the convention of scripts/locale-fixtures_test.mjs) so a stray
// environment variable can never switch the production site on.
export const partnerPrivacyEnabled = (): boolean =>
  PARTNER_PRIVACY_PAGE_LIVE || (!!process.env.UT_OUT_DIR && process.env.UT_PARTNER_PRIVACY_PAGE === 'on');
