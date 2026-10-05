/**
 * knowledge.mjs — Parse and search docs/KNOWLEDGE.md (the customer troubleshooting knowledge base).
 *
 * Topic format in the Markdown file:
 *   ## Human title
 *   <!-- topic: some-id; keywords: word, another phrase, … -->
 *   body…
 *
 * App links written as `(#/joysticks)` / `#/firmware?build=x` are expanded to absolute URLs with the
 * configured app base so assistants can paste them straight to customers.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const KNOWLEDGE_PATH = fileURLToPath(new URL('../docs/KNOWLEDGE.md', import.meta.url));

const TOPIC_RE = /^## (.+)\r?\n<!--\s*topic:\s*([\w-]+)\s*;\s*keywords:\s*(.*?)\s*-->\r?\n/;

/** @returns {{ intro: string, topics: Array<{id, title, keywords: string[], body: string}> }} */
export function loadKnowledge(base, file = KNOWLEDGE_PATH) {
  let text = '';
  try { text = readFileSync(file, 'utf8'); } catch { return { intro: '', topics: [], raw: '' }; }
  const expand = (s) => (base ? expandLinks(s, base) : s);
  const parts = text.split(/^(?=## )/m);
  const intro = parts[0].startsWith('## ') ? '' : parts.shift();
  const topics = [];
  for (const part of parts) {
    const m = part.match(TOPIC_RE);
    if (!m) continue; // a heading without a topic comment is just prose
    topics.push({
      id: m[2],
      title: m[1].trim(),
      keywords: m[3].split(',').map((k) => k.trim().toLowerCase()).filter(Boolean),
      body: expand(part.slice(m[0].length).trim()),
    });
  }
  return { intro: expand(intro.trim()), topics, raw: expand(text) };
}

/** `](#/x)` → `](<base>#/x)` and bare `` `#/x` `` code spans → absolute URLs. */
export function expandLinks(text, base) {
  return text
    .replace(/\]\(#\/([^)]*)\)/g, (_, rest) => `](${base}#/${rest})`)
    .replace(/`(#\/[^`\s]*)`/g, (_, hash) => `\`${base}${hash}\``);
}

const words = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[’']/g, '').split(/[^a-z0-9.+]+/).filter((w) => w.length > 1);
const STOP = new Set(['the', 'my', 'is', 'it', 'to', 'and', 'or', 'of', 'in', 'on', 'how', 'do', 'does', 'what', 'why', 'with', 'a', 'an', 'for', 'can', 'cant', 'wont', 'not', 'when', 'i', 'me', 'this', 'that', 'controller', 'gamepad']);

/**
 * Rank topics for a free-text query. An exact id match wins outright.
 * @returns {Array<{topic, score}>} best first, only positive scores
 */
export function searchKnowledge(kb, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const exact = kb.topics.find((t) => t.id === q || t.id === q.replace(/\s+/g, '-'));
  if (exact) return [{ topic: exact, score: Infinity }];
  const qWords = words(q).filter((w) => !STOP.has(w));
  return kb.topics.map((topic) => {
    let score = 0;
    for (const k of topic.keywords) if (q.includes(k)) score += k.includes(' ') ? 6 : 4;  // phrase hits
    const titleWords = new Set(words(topic.title));
    const kwWords = new Set(topic.keywords.flatMap(words));
    const bodyWords = new Set(words(topic.body));
    for (const w of qWords) {
      if (topic.id.split('-').includes(w)) score += 3;
      if (titleWords.has(w)) score += 3;
      if (kwWords.has(w)) score += 2;
      if (bodyWords.has(w)) score += 0.5;
    }
    return { topic, score };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}
