import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const CLI_PROBE_TIMEOUT_MS = 5_000;

export function cliAvailable(cmd: string, extraDirs: string[] = []): boolean {
  for (const dir of extraDirs) {
    if (!dir) continue;
    const candidates = [
      join(dir, `${cmd}.exe`),
      join(dir, `${cmd}.cmd`),
      join(dir, `${cmd}.CMD`),
      join(dir, cmd),
    ];
    if (candidates.some((candidate) => existsSync(candidate))) {
      return true;
    }
  }

  const where = spawnSync("where.exe", [cmd], {
    encoding: "utf8",
    windowsHide: true,
    timeout: CLI_PROBE_TIMEOUT_MS,
  });
  if (where.status === 0) return true;

  const help = spawnSync(cmd, ["--help"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: CLI_PROBE_TIMEOUT_MS,
  });
  return help.status === 0;
}

/** Resolve a project-local CLI under node_modules/.bin (Windows-aware). */
export function projectLocalCli(
  workspacePath: string,
  cli: string,
): string | null {
  const binDir = join(workspacePath, "node_modules", ".bin");
  const candidates = [
    join(binDir, `${cli}.CMD`),
    join(binDir, `${cli}.cmd`),
    join(binDir, cli),
    join(binDir, `${cli}.exe`),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
