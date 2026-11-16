// Where the public help pages' Markdown comes from (ut-docs#5355, part of
// #4504). The manual is written and versioned in the public product repo
// (universaltill/universal-till, web/help/<folder>/*.md plus
// web/help/img/<folder>/<id>.png); this site only publishes it. The build
// reads it from, in order:
//   1. HELP_SRC_DIR  - a directory laid out like web/help (the tests point
//      this at a tiny fixture; nothing is fetched).
//   2. .help-src/    - a sparse, shallow clone of the product repo at ONE ref,
//      made here when absent or when it is at a different ref.
// The ref is HELP_REF (a tag or branch name), else the product's latest GitHub
// release tag, else the highest vX.Y.Z tag from `git ls-remote`, else - local
// builds only, with a warning - `main`. In CI (CI / GITHUB_ACTIONS set) no ref
// FAILS the build rather than silently shipping unreleased text. If the source cannot be had the build FAILS: a
// committed copy would go stale silently, and an empty help centre must never
// ship looking like success.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_URL = 'https://github.com/universaltill/universal-till.git';
const API_LATEST = 'https://api.github.com/repos/universaltill/universal-till/releases/latest';
// A hung GitHub response must not hang the deploy (same cap as plugins.ts).
const FETCH_TIMEOUT_MS = 15_000;
const CLONE_TIMEOUT_MS = 120_000;

export interface HelpSource {
  /** A directory laid out like the product's web/help. */
  dir: string;
  /** The git ref the text was read at, or "fixture" for HELP_SRC_DIR. */
  ref: string;
}

/** The latest release tag, or null when GitHub can't say. */
export async function latestReleaseTag(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  try {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'universaltill-website-build' };
    if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const res = await fetch(API_LATEST, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tag = (await res.json())?.tag_name;
    if (typeof tag !== 'string' || !/^[\w.+-]{1,64}$/.test(tag)) throw new Error('no usable tag_name');
    return tag;
  } catch (err) {
    console.warn(`[help] could not read the latest release tag (${(err as Error).message})`);
    return null;
  }
}

/** The highest vX.Y.Z tag in `git ls-remote --tags --refs` output, or null. */
export function highestTag(output: string): string | null {
  let best: [number, number, number] | null = null;
  let tag: string | null = null;
  for (const line of output.split('\n')) {
    const m = line.match(/\trefs\/tags\/(v(\d+)\.(\d+)\.(\d+))$/);
    if (!m) continue;
    const v: [number, number, number] = [Number(m[2]), Number(m[3]), Number(m[4])];
    if (!best || v[0] > best[0] || (v[0] === best[0] && (v[1] > best[1] || (v[1] === best[1] && v[2] > best[2])))) {
      best = v;
      tag = m[1];
    }
  }
  return tag;
}

function lsRemoteTags(): string | null {
  try {
    return execFileSync('git', ['ls-remote', '--tags', '--refs', REPO_URL], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: CLONE_TIMEOUT_MS });
  } catch (err) {
    console.warn(`[help] git ls-remote failed (${(err as Error).message.split('\n')[0]})`);
    return null;
  }
}

export interface RefDeps {
  latest: () => Promise<string | null>;
  lsRemote: () => string | null;
}

/** Decide the ref to read. See the header for the order. */
export async function resolveRef(
  env: NodeJS.ProcessEnv = process.env,
  deps: RefDeps = { latest: () => latestReleaseTag(env), lsRemote: lsRemoteTags },
): Promise<string> {
  if (env.HELP_REF) return env.HELP_REF;
  const latest = await deps.latest();
  if (latest) return latest;
  const out = deps.lsRemote();
  const tag = out ? highestTag(out) : null;
  if (tag) {
    console.warn(`[help] release API unavailable; using the highest tag from git ls-remote: ${tag}`);
    return tag;
  }
  if (env.CI || env.GITHUB_ACTIONS) {
    throw new Error('[help] cannot determine the latest product release in CI (API and git ls-remote both failed); set HELP_REF to pin a tag. Not falling back to main.');
  }
  console.warn('[help] WARNING: falling back to the product repo main branch (local build); set HELP_REF to pin a ref');
  return 'main';
}

function git(args: string[], cwd?: string) {
  execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], timeout: CLONE_TIMEOUT_MS });
}

function cloneAt(ref: string, root: string) {
  // Only ever remove the directory this module owns.
  if (path.basename(root) !== '.help-src') throw new Error(`refusing to clear ${root}`);
  fs.rmSync(root, { recursive: true, force: true });
  git(['clone', '--quiet', '--depth', '1', '--filter=blob:none', '--sparse', '--branch', ref, REPO_URL, root]);
  git(['sparse-checkout', 'set', 'web/help'], root);
  fs.writeFileSync(path.join(root, '.ref'), `${ref}\n`);
}

let cache: Promise<HelpSource> | undefined;

export function resetHelpSourceCache() {
  cache = undefined;
}

/** The help source for this build; fetched at most once per process. */
export function ensureHelpSource(env: NodeJS.ProcessEnv = process.env): Promise<HelpSource> {
  cache ??= (async () => {
    if (env.HELP_SRC_DIR) {
      const dir = path.resolve(env.HELP_SRC_DIR);
      if (!fs.existsSync(path.join(dir, 'en'))) throw new Error(`[help] HELP_SRC_DIR ${dir} has no en/ folder`);
      console.log(`[help] source: ${dir} (HELP_SRC_DIR)`);
      return { dir, ref: 'fixture' };
    }
    const ref = await resolveRef(env);
    const root = path.resolve(process.cwd(), '.help-src');
    const helpDir = path.join(root, 'web', 'help');
    const have = fs.existsSync(path.join(root, '.ref')) ? fs.readFileSync(path.join(root, '.ref'), 'utf8').trim() : '';
    // A moving branch is always re-fetched; a tag is immutable, so reuse.
    if (have !== ref || ref === 'main' || !fs.existsSync(path.join(helpDir, 'en'))) {
      try {
        cloneAt(ref, root);
      } catch (err) {
        throw new Error(
          `[help] cannot fetch the help source (ref ${ref}) from ${REPO_URL}: ${(err as Error).message}. ` +
            'The build fails on purpose: a stale or empty help centre must not ship. ' +
            'Offline? Set HELP_SRC_DIR to a local web/help directory.',
        );
      }
    }
    if (!fs.existsSync(path.join(helpDir, 'en'))) throw new Error(`[help] ${helpDir}/en is missing after the clone`);
    console.log(`[help] source: universaltill/universal-till @ ${ref}`);
    return { dir: helpDir, ref };
  })();
  return cache;
}
