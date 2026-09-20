import { loadConfig } from "../core/config.js";
import { runDoctor } from "../doctor.js";

const result = runDoctor(loadConfig());
console.log(result.summary);
process.exit(result.ok ? 0 : 1);
