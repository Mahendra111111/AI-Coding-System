export type ProviderRole =
  | "code-structure"
  | "historical-memory"
  | "implementation-discipline"
  | "output-compression"
  | "tool-context-control"
  | "code-review"
  | "security-knowledge"
  | "fast-security"
  | "deep-security"
  | "formatting"
  | "js-quality"
  | "task-skills"
  | "decision-routing"
  | "runtime-verification"
  | "seo";

export interface ProviderEntry {
  id: string;
  role: ProviderRole;
  install: string;
  cli: string | null;
  checkout: string | null;
}

export interface ProviderRegistry {
  providers: ProviderEntry[];
}
