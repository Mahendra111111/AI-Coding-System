import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { SystemConfig } from "../core/config.js";

export type SecurityTopic =
  | "input-validation"
  | "auth"
  | "session"
  | "crypto"
  | "injection"
  | "access-control"
  | "config"
  | "general";

const REFS_ROOT = "providers/refs";
const OWASP_SCP = "providers/refs/owasp-scp";
const OWASP_TOP10 = "providers/refs/owasp-top10";

function topicKeywords(topic: SecurityTopic): string[] {
  switch (topic) {
    case "input-validation":
      return [
        "input",
        "validation",
        "validate",
        "sanitize",
        "allowlist",
        "whitelist",
      ];
    case "auth":
      return [
        "auth",
        "authentication",
        "password",
        "credential",
        "login",
        "identity",
      ];
    case "session":
      return ["session", "cookie", "jwt", "token", "logout", "timeout"];
    case "crypto":
      return [
        "crypto",
        "encrypt",
        "decrypt",
        "hash",
        "cipher",
        "tls",
        "certificate",
      ];
    case "injection":
      return [
        "injection",
        "sql",
        "xss",
        "ldap",
        "command",
        "parameterized",
      ];
    case "access-control":
      return [
        "access",
        "authorization",
        "permission",
        "rbac",
        "acl",
        "privilege",
      ];
    case "config":
      return [
        "config",
        "configuration",
        "hardening",
        "default",
        "deployment",
        "misconfiguration",
      ];
    case "general":
      return ["security", "owasp", "risk", "vulnerability", "secure"];
    default: {
      const _exhaustive: never = topic;
      return _exhaustive;
    }
  }
}

const ALL_TOPICS: SecurityTopic[] = [
  "input-validation",
  "auth",
  "session",
  "crypto",
  "injection",
  "access-control",
  "config",
  "general",
];

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".adoc",
  ".rst",
  ".html",
  ".htm",
]);

interface ScoredExcerpt {
  score: number;
  text: string;
}

function parseTopic(topic: string): SecurityTopic | null {
  if ((ALL_TOPICS as string[]).includes(topic)) {
    return topic as SecurityTopic;
  }
  return null;
}

function installHint(config: SystemConfig): string {
  const root = config.systemRoot;
  return `OWASP refs not installed.

Install both reference trees under ${resolve(root, REFS_ROOT)}:
- git clone --depth 1 https://github.com/OWASP/secure-coding-practices-quick-reference-guide.git ${resolve(root, OWASP_SCP)}
- git clone --depth 1 https://github.com/OWASP/Top10.git ${resolve(root, OWASP_TOP10)}

Or run: .\\scripts\\install-providers.ps1`;
}

function refsAvailable(config: SystemConfig): boolean {
  const root = config.systemRoot;
  return (
    existsSync(resolve(root, OWASP_SCP)) ||
    existsSync(resolve(root, OWASP_TOP10))
  );
}

function listTextFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) {
    return acc;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      listTextFiles(fullPath, acc);
      continue;
    }
    const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
    if (TEXT_EXTENSIONS.has(ext)) {
      acc.push(fullPath);
    }
  }

  return acc;
}

function countKeywordHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce(
    (total, keyword) => total + (lower.includes(keyword) ? 1 : 0),
    0,
  );
}

function excerptAroundKeywords(
  content: string,
  keywords: string[],
  contextLines = 2,
): string | null {
  const lines = content.split(/\r?\n/);
  const hits: number[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const lower = lines[i].toLowerCase();
    if (keywords.some((keyword) => lower.includes(keyword))) {
      hits.push(i);
    }
  }

  if (hits.length === 0) {
    return null;
  }

  const ranges: Array<[number, number]> = [];
  for (const line of hits) {
    const start = Math.max(0, line - contextLines);
    const end = Math.min(lines.length - 1, line + contextLines);
    ranges.push([start, end]);
  }

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range[0] > last[1] + 1) {
      merged.push(range);
    } else {
      last[1] = Math.max(last[1], range[1]);
    }
  }

  const chunks = merged.map(([start, end]) =>
    lines.slice(start, end + 1).join("\n").trim(),
  );

  return chunks.join("\n\n");
}

function collectExcerpts(
  config: SystemConfig,
  topic: SecurityTopic,
): ScoredExcerpt[] {
  const keywords = topicKeywords(topic);
  const refsRoot = resolve(config.systemRoot, REFS_ROOT);
  const files = listTextFiles(refsRoot);
  const excerpts: ScoredExcerpt[] = [];

  for (const file of files) {
    const relPath = relative(refsRoot, file).replace(/\\/g, "/");
    const content = readFileSync(file, "utf8");
    const pathHits = countKeywordHits(relPath, keywords);
    const bodyHits = countKeywordHits(content, keywords);
    const score = pathHits * 3 + bodyHits;

    if (score === 0) {
      continue;
    }

    const excerpt =
      excerptAroundKeywords(content, keywords) ??
      content.slice(0, 600).trim();

    excerpts.push({
      score,
      text: `## ${relPath}\n\n${excerpt}`,
    });
  }

  excerpts.sort((a, b) => b.score - a.score);
  return excerpts;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  if (maxChars <= 1) {
    return "…";
  }
  return `${text.slice(0, maxChars - 1)}…`;
}

function unknownTopicMessage(topic: string): string {
  return `Unknown topic: ${topic}

Supported topics: ${ALL_TOPICS.join(", ")}`;
}

export function securityRefs(
  config: SystemConfig,
  topic: string,
  maxChars = 2000,
): string {
  const parsed = parseTopic(topic);
  if (!parsed) {
    return unknownTopicMessage(topic);
  }

  if (!refsAvailable(config)) {
    return installHint(config);
  }

  const excerpts = collectExcerpts(config, parsed);
  if (excerpts.length === 0) {
    const fallback = `No OWASP excerpts matched topic "${parsed}". Try "general" or install/update refs under ${resolve(config.systemRoot, REFS_ROOT)}.`;
    return truncate(fallback, maxChars);
  }

  const header = `OWASP security refs — topic: ${parsed}\n\n`;
  let body = "";
  for (const excerpt of excerpts) {
    const next = body ? `${body}\n\n---\n\n${excerpt.text}` : excerpt.text;
    if (header.length + next.length > maxChars) {
      break;
    }
    body = next;
  }

  if (!body) {
    body = excerpts[0].text;
  }

  return truncate(`${header}${body}`, maxChars);
}
