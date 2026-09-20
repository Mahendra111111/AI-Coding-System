import { spawnSync } from "node:child_process";

export function cliAvailable(cmd: string): boolean {
  const help = spawnSync(cmd, ["--help"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (help.status === 0) return true;

  const where = spawnSync("where.exe", [cmd], {
    encoding: "utf8",
    windowsHide: true,
  });
  return where.status === 0;
}
