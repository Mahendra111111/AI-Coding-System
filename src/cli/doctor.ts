#!/usr/bin/env node
import { loadConfig } from "../core/config.js";
import { runDoctor } from "../doctor.js";

const result = runDoctor(loadConfig());
console.log(result.summary);
if (result.remediation) {
  console.log("");
  console.log(result.remediation);
}
process.exit(result.ok ? 0 : 1);
