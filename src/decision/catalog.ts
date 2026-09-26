export type DecisionFamily =
  | "context"
  | "memory"
  | "graph"
  | "quality"
  | "security"
  | "review"
  | "policy"
  | "meta"
  | "verify_ui"
  | "seo"
  | "no_tool";

export type DecisionToolId =
  | "prepare_context"
  | "get_project_context"
  | "memory_search"
  | "graph_query"
  | "graph_index"
  | "quality_check"
  | "quality_detect"
  | "security_scan"
  | "security_refs"
  | "review_diff"
  | "review_scan"
  | "discipline_rules"
  | "compression_guidance"
  | "finalize_task"
  | "provider_status"
  | "doctor"
  | "get_git_summary"
  | "reticle_verify"
  | "seo_guidance"
  | "no_tool";

export interface CatalogEntry {
  id: DecisionToolId;
  family: DecisionFamily;
  /** Short option text for System One criteria */
  label: string;
  /** Agent-facing next step hint */
  next: string;
}

export const FAMILY_CRITERIA: Record<DecisionFamily, string> = {
  context:
    "Load project brain, handoff, or task-scoped context before coding",
  memory: "Search or fetch historical Claude-Mem observations",
  graph: "Query or refresh the code structure knowledge graph",
  quality: "Run or detect Prettier/ESLint quality tooling",
  security: "Run security scanners or fetch OWASP secure-coding refs",
  review: "Diff or workspace code review via OpenCodeReview",
  policy: "Implementation discipline (Ponytail) or output compression (Caveman)",
  meta: "Doctor health, provider status, or git summary",
  verify_ui:
    "Verify a running owned web/desktop app with Reticle peer MCP (runtime truth)",
  seo: "ACS SEO Engine: people-first intent SEO + next-seo metadata/JSON-LD with target keywords (no ranking promises)",
  no_tool: "Implement or edit code without calling an ACS tool first",
};

export const TOOL_CATALOG: CatalogEntry[] = [
  {
    id: "prepare_context",
    family: "context",
    label: "Assemble task-scoped context with optional memory/graph",
    next: "Call prepare_context with workspacePath and task",
  },
  {
    id: "get_project_context",
    family: "context",
    label: "Load durable project brain (state, handoff, decisions, git)",
    next: "Call get_project_context with workspacePath or projectId",
  },
  {
    id: "memory_search",
    family: "memory",
    label: "Search selective Claude-Mem historical observations",
    next: "Call memory_search with a focused query",
  },
  {
    id: "graph_query",
    family: "graph",
    label: "Ask a question against the Graphify knowledge graph",
    next: "Call graph_query with workspacePath and question",
  },
  {
    id: "graph_index",
    family: "graph",
    label: "Build or refresh the Graphify index for the workspace",
    next: "Call graph_index with workspacePath",
  },
  {
    id: "quality_check",
    family: "quality",
    label: "Run detected Prettier/ESLint checks",
    next: "Call quality_check with workspacePath",
  },
  {
    id: "quality_detect",
    family: "quality",
    label: "Detect which formatter/linter the workspace uses",
    next: "Call quality_detect with workspacePath",
  },
  {
    id: "security_scan",
    family: "security",
    label: "Run Semgrep/CodeQL security scan by policy",
    next: "Call security_scan with workspacePath and policy light|normal|deep",
  },
  {
    id: "security_refs",
    family: "security",
    label: "Fetch compact OWASP secure-coding excerpts for a topic",
    next: "Call security_refs with a topic such as injection or auth",
  },
  {
    id: "review_diff",
    family: "review",
    label: "Review the current git diff with OpenCodeReview",
    next: "Call review_diff with workspacePath",
  },
  {
    id: "review_scan",
    family: "review",
    label: "Scan the workspace with OpenCodeReview",
    next: "Call review_scan with workspacePath",
  },
  {
    id: "discipline_rules",
    family: "policy",
    label: "Load Ponytail YAGNI / implementation discipline rules",
    next: "Call discipline_rules",
  },
  {
    id: "compression_guidance",
    family: "policy",
    label: "Load Caveman terse-output and Context Mode guidance",
    next: "Call compression_guidance",
  },
  {
    id: "finalize_task",
    family: "meta",
    label: "Run end-of-task checklist and update handoff",
    next: "Call finalize_task with workspacePath and checklist flags",
  },
  {
    id: "provider_status",
    family: "meta",
    label: "List optional provider enablement and availability",
    next: "Call provider_status",
  },
  {
    id: "doctor",
    family: "meta",
    label: "Run ACS health doctor including provider status",
    next: "Call doctor",
  },
  {
    id: "get_git_summary",
    family: "meta",
    label: "Summarize git status, branch, and recent commits",
    next: "Call get_git_summary with workspacePath",
  },
  {
    id: "reticle_verify",
    family: "verify_ui",
    label:
      "Prove a UI change on a running owned app via Reticle peer MCP tools",
    next: "Use Reticle peer MCP: reticle_snapshot → reticle_act_sequence → reticle_act_and_wait or reticle_assert",
  },
  {
    id: "seo_guidance",
    family: "seo",
    label:
      "ACS SEO Engine + next-seo: intent-driven copy, generateMetadata, JSON-LD from target keywords",
    next: "Call seo_guidance with keywords, workspacePath, and pageType; follow SEO-ENGINE.md; install next-seo in the app; ship SEO with content",
  },
  {
    id: "no_tool",
    family: "no_tool",
    label: "Proceed with code edits; no ACS tool required yet",
    next: "Continue implementing without an ACS tool call",
  },
];

export function toolsForFamily(family: DecisionFamily): CatalogEntry[] {
  return TOOL_CATALOG.filter((entry) => entry.family === family);
}

export function defaultToolForFamily(family: DecisionFamily): CatalogEntry {
  const tools = toolsForFamily(family);
  const preferred = tools[0];
  if (!preferred) {
    return TOOL_CATALOG.find((t) => t.id === "no_tool")!;
  }
  return preferred;
}

export function getToolEntry(id: string): CatalogEntry | undefined {
  return TOOL_CATALOG.find((entry) => entry.id === id);
}

export function familyCriteriaRecord(): Record<string, string> {
  return { ...FAMILY_CRITERIA };
}

export function toolCriteriaRecord(
  family: DecisionFamily,
): Record<string, string> {
  const tools = toolsForFamily(family);
  const out: Record<string, string> = {};
  for (const tool of tools) {
    out[tool.id] = tool.label;
  }
  return out;
}

export const RETICLE_PEER = {
  mcp: "reticle",
  flow: "snapshot → act_sequence → act_and_wait|assert",
} as const;
