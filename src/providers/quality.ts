import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MAX_OUTPUT_CHARS = 4000;

export type Formatter = "prettier" | "biome" | "none";
export type Linter = "eslint" | "biome" | "none";

export interface QualityStack {
  formatter: Formatter;
  linter: Linter;
  conflict: boolean;
  detail: string;
}

interface PackageIndicators {
  prettier: boolean;
  eslint: boolean;
  biome: boolean;
}

function truncate(text: string, max = MAX_OUTPUT_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function listFiles(workspacePath: string): string[] {
  try {
    return readdirSync(workspacePath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function readPackageJson(workspacePath: string): Record<string, unknown> | null {
  const packagePath = join(workspacePath, "package.json");
  if (!existsSync(packagePath)) return null;
  try {
    return JSON.parse(readFileSync(packagePath, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function depsContain(
  deps: unknown,
  packageName: string,
): boolean {
  if (!deps || typeof deps !== "object") return false;
  return Object.keys(deps as Record<string, unknown>).some(
    (name) => name === packageName || name.includes(packageName),
  );
}

function scriptsMention(
  scripts: unknown,
  tool: "prettier" | "eslint" | "biome",
): boolean {
  if (!scripts || typeof scripts !== "object") return false;
  return Object.values(scripts as Record<string, unknown>).some((value) => {
    if (typeof value !== "string") return false;
    const normalized = value.toLowerCase();
    switch (tool) {
      case "prettier":
        return normalized.includes("prettier");
      case "eslint":
        return normalized.includes("eslint");
      case "biome":
        return normalized.includes("biome");
      default: {
        const _exhaustive: never = tool;
        return _exhaustive;
      }
    }
  });
}

function packageIndicators(workspacePath: string): PackageIndicators {
  const pkg = readPackageJson(workspacePath);
  if (!pkg) {
    return { prettier: false, eslint: false, biome: false };
  }

  const depSections = [
    pkg.dependencies,
    pkg.devDependencies,
    pkg.peerDependencies,
    pkg.optionalDependencies,
  ];

  const prettier =
    depSections.some((deps) => depsContain(deps, "prettier")) ||
    scriptsMention(pkg.scripts, "prettier");
  const eslint =
    depSections.some((deps) => depsContain(deps, "eslint")) ||
    scriptsMention(pkg.scripts, "eslint");
  const biome =
    depSections.some((deps) => depsContain(deps, "@biomejs/biome")) ||
    depSections.some((deps) => depsContain(deps, "biome")) ||
    scriptsMention(pkg.scripts, "biome");

  return { prettier, eslint, biome };
}

function hasPrettierConfig(workspacePath: string): boolean {
  const files = listFiles(workspacePath);
  if (files.some((name) => name.startsWith(".prettierrc"))) return true;
  if (
    files.some((name) =>
      /^prettier\.config\.(js|cjs|mjs|ts)$/i.test(name),
    )
  ) {
    return true;
  }
  return packageIndicators(workspacePath).prettier;
}

function hasEslintConfig(workspacePath: string): boolean {
  const files = listFiles(workspacePath);
  if (files.some((name) => /^eslint\.config\.(js|cjs|mjs|ts)$/i.test(name))) {
    return true;
  }
  return packageIndicators(workspacePath).eslint;
}

function hasBiomeConfig(workspacePath: string): boolean {
  if (
    existsSync(join(workspacePath, "biome.json")) ||
    existsSync(join(workspacePath, "biome.jsonc"))
  ) {
    return true;
  }
  return packageIndicators(workspacePath).biome;
}

export function detectQualityStack(workspacePath: string): QualityStack {
  const prettier = hasPrettierConfig(workspacePath);
  const eslint = hasEslintConfig(workspacePath);
  const biome = hasBiomeConfig(workspacePath);

  const prettierBiomeConflict = prettier && biome;
  const eslintBiomeConflict = eslint && biome;
  const conflict = prettierBiomeConflict || eslintBiomeConflict;

  let formatter: Formatter = "none";
  let linter: Linter = "none";

  if (biome && !prettier) {
    formatter = "biome";
  } else if (prettier) {
    formatter = "prettier";
  }

  if (biome && !eslint) {
    linter = "biome";
  } else if (eslint) {
    linter = "eslint";
  }

  const parts: string[] = [];
  if (prettier) parts.push("Prettier configured");
  if (eslint) parts.push("ESLint configured");
  if (biome) parts.push("Biome configured");

  if (parts.length === 0) {
    return {
      formatter: "none",
      linter: "none",
      conflict: false,
      detail: "No quality tools detected (checked biome.json, .prettierrc*, eslint.config.*, package.json).",
    };
  }

  if (conflict) {
    const conflicts: string[] = [];
    if (prettierBiomeConflict) conflicts.push("Prettier + Biome");
    if (eslintBiomeConflict) conflicts.push("ESLint + Biome");
    return {
      formatter,
      linter,
      conflict: true,
      detail: `${parts.join("; ")}. Conflict: ${conflicts.join(" and ")} — choose one toolchain.`,
    };
  }

  return {
    formatter,
    linter,
    conflict: false,
    detail: parts.join("; "),
  };
}

function runCommand(
  label: string,
  command: string,
  args: string[],
  cwd: string,
): string {
  try {
    const stdout = execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 120_000,
    });
    return `=== ${label} ===\n${stdout.trim() || "(no output)"}`;
  } catch (err) {
    const execErr = err as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    const stdout = execErr.stdout?.trim() ?? "";
    const stderr = execErr.stderr?.trim() ?? "";
    const body = [stdout, stderr].filter(Boolean).join("\n");
    return `=== ${label} ===\nFailed: ${body || execErr.message || "command failed"}`;
  }
}

export function runQualityCheck(workspacePath: string): string {
  const stack = detectQualityStack(workspacePath);

  if (stack.conflict) {
    return truncate(
      `Quality tool conflict detected.\n${stack.detail}\nSkipped auto-run; resolve the conflict first.`,
    );
  }

  if (stack.formatter === "none" && stack.linter === "none") {
    return truncate(
      "No quality tools configured. Checked biome.json, .prettierrc*, eslint.config.*, and package.json deps/scripts.",
    );
  }

  const sections: string[] = [`Detected: ${stack.detail}`];

  if (stack.formatter === "biome" && stack.linter === "biome") {
    sections.push(
      runCommand(
        "biome check",
        "npx",
        ["--no", "@biomejs/biome", "check", "."],
        workspacePath,
      ),
    );
  } else {
    if (stack.formatter === "prettier") {
      sections.push(
        runCommand(
          "prettier --check",
          "npx",
          ["--no", "prettier", "--check", "."],
          workspacePath,
        ),
      );
    } else if (stack.formatter === "biome") {
      sections.push(
        runCommand(
          "biome format",
          "npx",
          ["--no", "@biomejs/biome", "format", "--write=false", "."],
          workspacePath,
        ),
      );
    }

    if (stack.linter === "eslint") {
      sections.push(
        runCommand("eslint", "npx", ["--no", "eslint", "."], workspacePath),
      );
    } else if (stack.linter === "biome") {
      sections.push(
        runCommand(
          "biome lint",
          "npx",
          ["--no", "@biomejs/biome", "lint", "."],
          workspacePath,
        ),
      );
    }
  }

  return truncate(sections.join("\n\n"));
}
