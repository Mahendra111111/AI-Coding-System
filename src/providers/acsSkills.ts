import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SystemConfig } from "../core/config.js";

export interface AcsSkillSummary {
  name: string;
  description: string;
  path: string;
  isTemplate: boolean;
}

function parseFrontmatter(raw: string): {
  name?: string;
  description?: string;
} {
  if (!raw.startsWith("---")) return {};
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return {};
  const block = raw.slice(3, end).trim();
  const result: { name?: string; description?: string } = {};
  let currentKey: "name" | "description" | null = null;
  let descriptionLines: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    const match = /^(name|description):\s*(.*)$/.exec(line);
    if (match) {
      if (currentKey === "description" && descriptionLines.length > 0) {
        result.description = descriptionLines.join(" ").trim();
      }
      const key = match[1] as "name" | "description";
      const value = match[2].trim();
      currentKey = key;
      if (key === "name") {
        result.name = value;
        descriptionLines = [];
      } else if (value === ">" || value === "|") {
        descriptionLines = [];
      } else {
        descriptionLines = [value.replace(/^>\s*/, "")];
      }
      continue;
    }
    if (currentKey === "description" && /^\s+/.test(line)) {
      descriptionLines.push(line.trim());
    }
  }
  if (currentKey === "description" && descriptionLines.length > 0) {
    result.description = descriptionLines.join(" ").trim();
  }
  return result;
}

/** List Anthropic-style ACS task skills under skills/ (Task 14 template layout). */
export function listAcsSkills(config: SystemConfig): AcsSkillSummary[] {
  const skillsRoot = join(config.systemRoot, "skills");
  if (!existsSync(skillsRoot)) return [];

  const results: AcsSkillSummary[] = [];
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const skillMd = join(skillsRoot, entry.name, "SKILL.md");
    if (!existsSync(skillMd)) continue;
    const raw = readFileSync(skillMd, "utf8");
    const meta = parseFrontmatter(raw);
    results.push({
      name: meta.name || entry.name,
      description:
        meta.description ||
        (entry.name === "_template"
          ? "Copy this template to create a new ACS task skill."
          : "ACS task skill"),
      path: skillMd,
      isTemplate: entry.name === "_template",
    });
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function formatAcsSkills(config: SystemConfig): string {
  const skills = listAcsSkills(config);
  if (skills.length === 0) {
    return [
      "No ACS task skills found under skills/.",
      "Copy skills/_template to skills/<name>/ and edit SKILL.md (Task 14 Anthropic-style layout).",
    ].join("\n");
  }

  const lines = [
    "ACS Anthropic-style task skills (not a full anthropics/skills clone):",
    "",
  ];
  for (const skill of skills) {
    const tag = skill.isTemplate ? " [template]" : "";
    lines.push(`- ${skill.name}${tag}: ${skill.description}`);
    lines.push(`  ${skill.path}`);
  }
  lines.push("");
  lines.push(
    "Add a skill: copy skills/_template → skills/<skill-name>/ then edit SKILL.md.",
  );
  return lines.join("\n");
}
