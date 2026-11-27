// The /<locale>/pricing page body, rendered at build time (ut-docs#4963).
//
// Every amount comes from site/plan-prices.js, which scripts/gen-plan-prices.mjs
// generates from data/plan-prices.json: no amount is typed in a template or in
// i18n/en.json. Rendering here (not in the browser) puts the prices in the raw
// HTML, so a crawler and a visitor with JavaScript off see them. One page shows
// ONE market, chosen from the URL locale (marketOf, ut-docs#6722): no tabs, no
// picker, no other country's prices. Strings come from the page locale's
// dictionary with the usual English fallback; the plan names and the TSE, VAT
// and "not yet" wording reuse the wizard's keys (wiz.*) so the two never differ.
// @ts-ignore - raw text of a classic script
import pricesSource from '../../site/plan-prices.js?raw';

type Plan = { monthly: number; annualPerMonth: number };
interface Market { currency: string; tsePerMainTill: number; plans: Record<string, Plan>; tseFromPlan?: string; tseMinMonths?: number }
interface Prices { effectiveFrom: string; extraLocation: { monthly: number; annualPerMonth: number; maxLocations: number }; includedLocations: number; markets: Record<string, Market> }

export const PRICES: Prices = (() => {
  const g: any = {};
  new Function('globalThis', pricesSource as string)(g);
  if (!g.UT_PLAN_PRICES) throw new Error('pricing: site/plan-prices.js did not define UT_PLAN_PRICES');
  return g.UT_PLAN_PRICES;
})();

export const PAID_PLANS = ['plus', 'shop', 'pro', 'multi'] as const;
const ALL_PLANS = ['local', ...PAID_PLANS] as const;

/**
 * The ONE priced market a locale's page shows (ut-docs#6722); null = no priced
 * market, so the page shows no prices. The URL locale is the country:
 * en-gb -> uk (GBP), de-de -> de (EUR), the eurozone locales -> eu (EUR),
 * every other locale (ar-sa, fa-ir, ms-my, tr-tr, zh-cn, ...) -> null.
 */
const EUROZONE_LOCALES = ['el-gr', 'es-es', 'fr-fr', 'it-it', 'pt-pt'];
export const marketOf = (locale: string): string | null =>
  locale === 'en-gb' ? 'uk' : locale === 'de-de' ? 'de' : EUROZONE_LOCALES.includes(locale) ? 'eu' : null;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));

export interface PricingResult { html: string; usedFallback: boolean }

export function pricingHtml(locale: string, bcp47: string, dict: Record<string, string>): PricingResult {
  const fb = new Set<string>(dict._fb ?? []);
  let usedFallback = false;
  const tx = (key: string, vars: Record<string, string> = {}): string => {
    const raw = dict[key];
    if (raw == null) throw new Error(`pricing: missing key ${key} for ${locale}`);
    const text = esc(fill(raw, vars));
    if (!fb.has(key)) return text;
    usedFallback = true;
    return `<span lang="en" dir="ltr" data-i18n-fallback>${text}</span>`;
  };
  // Digits follow the surrounding text, as in the wizard: Persian digits in fa, Latin elsewhere.
  const numLocale = locale === 'fa-ir' ? bcp47 + '-u-nu-arabext' : bcp47 + '-u-nu-latn';
  const num = (n: number) => new Intl.NumberFormat(numLocale).format(n);
  // Whole amounts show no decimals; 24.17 keeps its cents (same rule as the wizard).
  const money = (currency: string, amount: number) => {
    const frac = Math.round(amount) === amount ? 0 : 2;
    return new Intl.NumberFormat(numLocale, { style: 'currency', currency, minimumFractionDigits: frac, maximumFractionDigits: frac }).format(amount);
  };
  const date = new Intl.DateTimeFormat(numLocale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(PRICES.effectiveFrom + 'T00:00:00Z'));
  const talk = 'mailto:hello@universaltill.com?subject=Plans%20and%20pricing';

  const panel = (m: string): string => {
    const mk = PRICES.markets[m];
    const cur = mk.currency;
    const cards = ALL_PLANS.map((p) => {
      const pl = mk.plans[p];
      const free = pl.monthly === 0;
      const feats = [1, 2, 3, 4].filter((i) => dict[`pricing.f.${p}.${i}`] != null).map((i) => `<li>${tx(`pricing.f.${p}.${i}`)}</li>`).join('');
      let price: string;
      if (free) {
        price = `<p class="price-main" data-plan-price="${p}">${tx('wiz.price.free')}</p>`;
      } else {
        price =
          `<p class="price-main" data-plan-price="${p}" data-billing="annual">${tx('pricing.price.annual', { price: money(cur, pl.annualPerMonth) })}</p>` +
          `<p class="price-sub" data-billing="annual-total">${tx('pricing.price.annual.total', { total: money(cur, pl.monthly * 10) })}</p>` +
          `<p class="price-sub" data-billing="monthly">${tx('pricing.price.monthly', { price: money(cur, pl.monthly) })}</p>`;
      }
      const extra = p === 'multi'
        ? `<p class="price-sub" data-extra-location>${tx('pricing.extra', { price: money(cur, PRICES.extraLocation.annualPerMonth), monthly: money(cur, PRICES.extraLocation.monthly), included: num(PRICES.includedLocations), max: num(PRICES.extraLocation.maxLocations) })}</p>`
        : '';
      const cta = free
        ? `<a class="btn primary" href="/download">${tx('wiz.cta.download')}</a>`
        : `<a class="btn primary" href="/find-your-setup">${tx('pricing.cta.paid')}</a>`;
      return `<article class="card price-card" data-plan="${p}"><h3>${tx('wiz.plan.' + p)}</h3>${price}${extra}<ul class="price-feats">${feats}</ul><p class="price-cta">${cta}</p></article>`;
    }).join('');
    const enterprise = `<article class="card price-card" data-plan="enterprise"><h3>${tx('wiz.plan.enterprise')}</h3><p class="price-main">${tx('pricing.talk')}</p><ul class="price-feats"><li>${tx('pricing.f.enterprise.1')}</li></ul><p class="price-cta"><a class="btn" href="${talk}">${tx('wiz.cta.talk')}</a></p></article>`;
    let tse = '';
    if (mk.tsePerMainTill > 0) {
      const v = { price: money(cur, mk.tsePerMainTill), tse: money(cur, mk.tsePerMainTill), months: num(mk.tseMinMonths ?? 0) };
      tse = `<div class="price-tse" data-tse><h3>${tx('pricing.tse.t')}</h3><p>${tx('wiz.n.detsemin', v)}</p><p>${tx('wiz.price.tse', v)}</p><p>${tx('wiz.price.tsemin', v)}</p><p>${tx('wiz.n.deowndevice')}</p></div>`;
    }
    const label = tx('pricing.market.' + m);
    return `<div class="price-market" data-market="${m}" role="group" aria-label="${esc(dict['pricing.market.' + m])}"><h2>${label}</h2><div class="grid price-grid">${cards}${enterprise}</div>${tse}</div>`;
  };

  // A locale with no priced market: free Local and Talk to us, never another country's prices.
  const unpriced = (): string => {
    const local = `<article class="card price-card" data-plan="local"><h3>${tx('wiz.plan.local')}</h3><p class="price-main" data-plan-price="local">${tx('wiz.price.free')}</p><ul class="price-feats">${[1, 2, 3].map((i) => `<li>${tx('pricing.f.local.' + i)}</li>`).join('')}</ul><p class="price-cta"><a class="btn primary" href="/download">${tx('wiz.cta.download')}</a></p></article>`;
    const enterprise = `<article class="card price-card" data-plan="enterprise"><h3>${tx('wiz.plan.enterprise')}</h3><p class="price-main">${tx('pricing.talk')}</p><p>${tx('wiz.price.unpub')}</p><p class="price-cta"><a class="btn" href="${talk}">${tx('wiz.cta.talk')}</a></p></article>`;
    return `<div class="price-market" data-market="none" role="group" aria-label="${esc(dict['pricing.other.t'])}"><h2>${tx('pricing.other.t')}</h2><div class="grid price-grid">${local}${enterprise}</div></div>`;
  };
  const market = marketOf(locale);

  const gaps = ['appointments', 'online', 'mobilesync', 'accountant', 'phone'].map((g) => `<li>${tx('wiz.gap.' + g)}</li>`).join('');
  const html =
    (market ? `<p class="price-intro">${tx('pricing.billing')}</p><p class="price-intro">${tx('pricing.vat')}</p><p class="price-intro">${tx('pricing.cardfee')}</p>` : '') +
    (market ? panel(market) : unpriced()) +
    `<div class="price-gaps"><h2>${tx('wiz.res.gaps')}</h2><ul>${gaps}</ul></div>` +
    (market ? `<p class="price-eff" data-effective-from="${PRICES.effectiveFrom}">${tx('pricing.effective', { date })}</p>` : '') +
    `<p class="price-legal"><a href="/legal/terms">${tx('foot.terms')}</a> · <a href="/legal/subscription-terms">${tx('pricing.legal.sub')}</a> · <a href="/legal/privacy">${tx('foot.privacy')}</a></p>`;
  return { html, usedFallback };
}
