// Which site locales have public help pages (ut-docs#5355, #6948). The list is
// data in scripts/lib/help-locales.mjs so the build guard reads the same one.
// @ts-ignore - plain ESM shared with the node scripts
import { HELP_UNPUBLISHED as U, hasHelp as h, helpLocaleFor as f } from '../../scripts/lib/help-locales.mjs';

export const HELP_UNPUBLISHED: readonly string[] = U;
export const hasHelp: (locale: string) => boolean = h;
export const helpLocaleFor: (locale: string) => string = f;
