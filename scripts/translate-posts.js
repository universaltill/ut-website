#!/usr/bin/env node
// Translate blog posts into every locale using the SELF-HOSTED model on the
// homelab — never a paid AI API. That is a standing product rule for anything
// that ships, and this is build-time tooling on the same principle: the
// translations are committed to the repo, so the published site depends on
// files in git, not on a model being up.
//
// Target: **Ollama on the NAS** (192.168.1.231, `nas/ollama/` in
// homelab-k8s), not the LM Studio instance on a laptop. The NAS is always on,
// so this runs unattended — from a cron pipeline, or by anyone on the team —
// rather than only when one particular machine happens to be awake.
//
// It needs the bearer token that gate requires: `OLLAMA_TOKEN`, or it fetches
// `ollama-api-token` from Key Vault via `az` if you are logged in. Never
// hard-code it, and never pass it on a command line where it lands in shell
// history.
//
//   node scripts/translate-posts.js            # fill in what's missing
//   node scripts/translate-posts.js --force    # redo everything
//   node scripts/translate-posts.js --locale tr-tr --slug whats-new-v0-2-70
//
// English posts live in src/content/blog/en-gb/ and are the source of truth —
// an editor writes those in Decap. Translations land beside them in
// src/content/blog/<locale>/ with the same filename, carrying
// `machineTranslated: true` so the page can say so. A missing translation is
// not an error: the site falls back to English and says which post it is.
//
// The endpoint is LAN-only, so this cannot run in GitHub-hosted CI. That is
// deliberate rather than a gap — the output is reviewed and committed like any
// other content, not generated during a deploy nobody is watching.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BLOG = path.join(ROOT, "src", "content", "blog");
const SOURCE_LOCALE = "en-gb";

const ENDPOINT = process.env.LOCAL_LLM_URL || "http://192.168.1.231:11434/api/chat";
// The 30B MoE, not the 8B dense: only ~3B parameters are active per token, so
// on CPU it costs about the same as the 8B while translating visibly better.
// Measured on the 8B: "roadmap" left untranslated in Turkish copy, and "live"
// rendered as "canlı" where a Turkish reader expects "yayında". This is
// public marketing copy — the quality difference is the whole point of
// running a bigger model on a box with 54 GB free.
const MODEL = process.env.LOCAL_LLM_MODEL || "qwen3:30b-a3b";

// Resolve the token once: explicit env wins, otherwise ask Key Vault. A
// missing token is a 401 from the gate, which is a much clearer failure than
// a silent empty translation.
function resolveToken() {
  if (process.env.OLLAMA_TOKEN) return process.env.OLLAMA_TOKEN;
  try {
    return execFileSync(
      "az",
      ["keyvault", "secret", "show", "--vault-name", "kv-unitill-dev", "-n", "ollama-api-token", "--query", "value", "-o", "tsv"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    return "";
  }
}
const TOKEN = resolveToken();

// Named in the target language's own terms, and told what NOT to touch. The
// last two rules exist because a translation that renames a product or
// rewrites a URL looks fluent and is broken.
const LOCALES = {
  "tr-tr": { language: "Turkish (Türkçe)", audience: "shop owners in Turkey" },
  "zh-cn": { language: "Simplified Chinese (简体中文)", audience: "shop owners in China" },
  "fa-ir": { language: "Persian/Farsi (فارسی)", audience: "shop owners in Iran" },
};

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
};
const onlyLocale = only("--locale");
const onlySlug = only("--slug");

function splitFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("post has no frontmatter");
  return { frontmatter: match[1], body: match[2] };
}

function field(frontmatter, name) {
  const m = frontmatter.match(new RegExp(`^${name}:\\s*(.*)$`, "m"));
  return m ? m[1].trim().replace(/^"(.*)"$/, "$1") : null;
}

async function ask(prompt, system) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: JSON.stringify({
      model: MODEL,
      // STREAMING, and not for progress bars: Node's fetch gives up if no
      // response HEADERS arrive within 300s, and a cold 18 GB model on CPU
      // takes longer than that to load and start answering. A non-streaming
      // call therefore died with a bare "fetch failed" after five minutes —
      // which reads like a network fault and is really a timeout. Streaming
      // sends headers immediately and resets the clock on every chunk.
      stream: true,
      // Qwen3 reasons before answering unless told not to. Translation is not
      // a reasoning task, and the block silently ate the token budget: the
      // model returned an EMPTY message rather than an error. This is the
      // native Ollama switch; the OpenAI-compatible /v1 path has no equivalent
      // and produced exactly that empty reply when tried.
      think: false,
      options: {
        // Low but not zero: translation wants faithfulness, not invention.
        temperature: 0.2,
        num_predict: 16000,
        // Measured on this box: llama.cpp sizes its own pool from visible
        // CPUs, and 8 threads roughly DOUBLES throughput over its default
        // here (~10 tok/s vs ~5). The container is pinned to 8 CPUs, so this
        // matches the cpuset rather than oversubscribing it.
        num_thread: 8,
      },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (res.status === 401) {
    throw new Error(
      "401 from the Ollama gate — set OLLAMA_TOKEN, or `az login` so the token can be read from Key Vault",
    );
  }
  if (!res.ok) throw new Error(`${ENDPOINT} returned HTTP ${res.status}`);

  // Ollama streams newline-delimited JSON, one object per chunk. Buffer by
  // line rather than by chunk: a JSON object can be split across TCP reads,
  // and parsing a half object would fail intermittently and only on long
  // outputs — the worst kind of flake to chase.
  let text = "";
  let buffered = "";
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    buffered += decoder.decode(chunk, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const part = JSON.parse(line);
      if (part.error) throw new Error(part.error);
      text += part.message?.content ?? "";
    }
  }
  if (!text) throw new Error("model returned no content");
  // Qwen "thinking" models emit a reasoning block before the answer.
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // And they like wrapping output in a code fence even when told not to.
  const fenced = text.match(/^```(?:mdx|markdown|md)?\n([\s\S]*?)\n```$/);
  return (fenced ? fenced[1] : text).trim();
}

const SYSTEM = `You are a professional software-localisation translator.
You translate marketing and release-notes copy for a point-of-sale product.
You never add, remove or explain anything: you translate.`;

function promptFor(locale, { title, excerpt, body }) {
  const { language, audience } = LOCALES[locale];
  return `Translate the following blog post into ${language}, for ${audience}.

Rules:
- Translate the TITLE, the EXCERPT and the BODY. Output them in exactly the
  format shown at the end, with nothing before or after.
- Keep every Markdown structure identical: the same headings at the same
  levels, the same bullet lists, the same bold/italic spans, the same order.
- Do NOT translate: the product name "Universal Till"; version numbers;
  file names; anything inside \`backticks\`; URLs and link targets. Link TEXT
  should be translated.
- Keep German legal terms that name a specific thing (e.g. "Pfandrückgabe")
  as-is, adding a short parenthetical gloss in ${language} the first time.
- Natural, fluent ${language} written for a shop owner — not word-for-word
  English, and not more formal than the original.

Output format, exactly:
TITLE: <translated title>
EXCERPT: <translated excerpt>
BODY:
<translated markdown body>

Here is the post:

TITLE: ${title}
EXCERPT: ${excerpt}
BODY:
${body}`;
}

function parseResponse(text) {
  const title = text.match(/^TITLE:\s*(.+)$/m)?.[1]?.trim();
  const excerpt = text.match(/^EXCERPT:\s*(.+)$/m)?.[1]?.trim();
  const body = text.split(/^BODY:\s*$/m)[1]?.trim();
  if (!title || !excerpt || !body) throw new Error("model output did not match the requested format");
  return { title, excerpt, body };
}

// Cheap structural checks. A mistranslation reads fine and is a judgement
// call; a DROPPED section or a rewritten URL is a defect, and both are things
// a model does quietly when it decides to summarise.
function verify(source, translated, locale) {
  const problems = [];
  const headings = (s) => (s.match(/^#{1,6} /gm) || []).length;
  if (headings(translated.body) !== headings(source.body)) {
    problems.push(
      `heading count ${headings(translated.body)} != ${headings(source.body)} — a section was dropped or invented`,
    );
  }
  const links = (s) => (s.match(/\]\(([^)]+)\)/g) || []).sort();
  if (JSON.stringify(links(translated.body)) !== JSON.stringify(links(source.body))) {
    problems.push("link targets changed");
  }
  if (!translated.body.includes("Universal Till")) {
    problems.push("the product name is missing — it must not be translated");
  }
  // Did it actually translate, or hand back English? Ask for the target
  // script rather than counting Latin characters — "Universal Till" is
  // supposed to stay Latin in every locale, which made the naive check fire
  // on a perfectly good Chinese title.
  const SCRIPT = { "zh-cn": /\p{Script=Han}/u, "fa-ir": /\p{Script=Arabic}/u };
  const expected = SCRIPT[locale];
  if (expected && !expected.test(translated.title)) {
    problems.push("title is not in the target script — it came back untranslated");
  }
  if (locale === "tr-tr" && translated.title === source.title) {
    problems.push("title is identical to the English — it came back untranslated");
  }
  return problems;
}

function render(locale, source, translated, slug) {
  const fm = source.frontmatter
    .replace(/^title:.*$/m, `title: ${JSON.stringify(translated.title)}`)
    .replace(/^excerpt:.*$/m, `excerpt: ${JSON.stringify(translated.excerpt)}`);
  return `---
${fm}
# Generated by scripts/translate-posts.js from ../${SOURCE_LOCALE}/${slug}.mdx
# using the self-hosted model on the homelab. Edit the English original and
# re-run rather than patching this file, or the two drift apart.
machineTranslated: true
---

${translated.body}
`;
}

const sources = fs
  .readdirSync(path.join(BLOG, SOURCE_LOCALE))
  .filter((f) => f.endsWith(".mdx"))
  .filter((f) => !onlySlug || f === `${onlySlug}.mdx`);

const targets = Object.keys(LOCALES).filter((l) => !onlyLocale || l === onlyLocale);

let written = 0;
let failed = 0;

for (const file of sources) {
  const slug = file.replace(/\.mdx$/, "");
  const raw = fs.readFileSync(path.join(BLOG, SOURCE_LOCALE, file), "utf8");
  const { frontmatter, body } = splitFrontmatter(raw);
  const source = {
    frontmatter,
    body,
    title: field(frontmatter, "title"),
    excerpt: field(frontmatter, "excerpt"),
  };

  for (const locale of targets) {
    const out = path.join(BLOG, locale, file);
    if (fs.existsSync(out) && !force) {
      console.log(`skip   ${locale}/${file} (exists — use --force to redo)`);
      continue;
    }

    process.stdout.write(`write  ${locale}/${file} … `);
    try {
      // Retry with the complaint fed back in. A model that summarised a
      // section usually stops doing it when told exactly what it dropped, and
      // silently shipping a shortened translation is worse than a slow one.
      let translated;
      let problems = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const extra = problems.length
          ? `\n\nYour previous attempt was rejected: ${problems.join("; ")}. Translate the WHOLE post, keeping every heading and link exactly as in the source.`
          : "";
        translated = parseResponse(await ask(promptFor(locale, source) + extra, SYSTEM));
        problems = verify(source, translated, locale);
        if (!problems.length) break;
        process.stdout.write(`retry ${attempt} … `);
      }
      if (problems.length) {
        console.log(`REJECTED\n       ${problems.join("\n       ")}`);
        failed++;
        continue;
      }
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, render(locale, source, translated, slug));
      console.log("ok");
      written++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failed++;
    }
  }
}

console.log(`\n${written} written, ${failed} failed.`);
if (failed) {
  console.log("Failures leave the English post in place — the site falls back to it.");
  process.exit(1);
}
