import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadConfig } from "../core/config.js";
import { buildProjectContext } from "../context/buildContext.js";
import { runDoctor } from "../doctor.js";
import {
  graphExplain,
  graphExtract,
  graphQuery,
  isGraphifyAvailable,
} from "../graph/graphify.js";
import { formatGitSummary, getGitSummary } from "../git/summary.js";
import { finalizeTask } from "../orchestrator/finalizeTask.js";
import { prepareContext } from "../orchestrator/prepareContext.js";
import { decideGate, decideTools } from "../decision/decideTools.js";
import {
  listProjects,
  registerProject,
  resolveProjectId,
} from "../project/register.js";
import {
  readHandoff,
  updateHandoff,
  updateProjectState,
} from "../project/state.js";
import { formatAcsSkills } from "../providers/acsSkills.js";
import { getCavemanGuidance } from "../providers/caveman.js";
import { memoryGet, memorySearch } from "../providers/claudeMem.js";
import { runOpenCodeReview } from "../providers/openCodeReview.js";
import { securityRefs } from "../providers/owasp.js";
import { getDisciplineRules } from "../providers/ponytail.js";
import {
  detectQualityStack,
  runQualityCheck,
} from "../providers/quality.js";
import { getReticleGuidance } from "../providers/reticle.js";
import { getSeoGuidance } from "../providers/nextSeo.js";
import { getAllProviderStatuses } from "../providers/status.js";
import { runSecurityScan } from "../security/scan.js";

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function createServer(): McpServer {
  const config = loadConfig();
  const server = new McpServer({
    name: "ai-coding-system",
    version: "1.0.0",
  });

  server.tool(
    "register_project",
    "Register or load a project brain for a workspace path. Idempotent. Creates durable state under C:\\AI-Coding-System\\projects\\<id> when new.",
    {
      workspacePath: z
        .string()
        .describe("Absolute path to the source workspace (e.g. D:\\\\Projects\\\\MyApp)"),
      editor: z
        .string()
        .optional()
        .describe("Editor name, e.g. cursor, antigravity, claude-code"),
      sessionId: z.string().optional().describe("Optional session identifier"),
    },
    async ({ workspacePath, editor, sessionId }) => {
      const result = registerProject(config, {
        workspacePath,
        editor,
        sessionId,
      });
      return textResult(
        JSON.stringify(
          {
            created: result.created,
            projectId: result.meta.projectId,
            projectName: result.meta.projectName,
            workspacePath: result.meta.workspacePath,
            gitRemote: result.meta.gitRemote,
            brainPath: result.brainPath,
            contextPath: result.contextPath,
            identitySource: result.meta.identitySource,
          },
          null,
          2,
        ),
      );
    },
  );

  server.tool(
    "get_project_context",
    "Return compact durable project context (state, handoff, decisions, constraints, git). Call this before coding so you understand prior work across editors.",
    {
      workspacePath: z.string().optional(),
      projectId: z.string().optional(),
      includeGit: z.boolean().optional().default(true),
    },
    async ({ workspacePath, projectId, includeGit }) => {
      if (!workspacePath && !projectId) {
        return textResult("Error: provide workspacePath or projectId");
      }
      if (workspacePath) {
        registerProject(config, { workspacePath });
      }
      const built = buildProjectContext(config, {
        workspacePath,
        projectId,
        includeGit,
      });
      return textResult(built.context);
    },
  );

  server.tool(
    "prepare_context",
    "Assemble task-scoped context in priority order. Optionally includes selective memory and Graphify relationships; never dumps repositories, full memory, or full OWASP references.",
    {
      workspacePath: z.string().describe("Absolute workspace path"),
      task: z.string().min(1).describe("Current task and acceptance criteria"),
      includeMemory: z.boolean().optional().default(false),
      includeGraph: z.boolean().optional().default(false),
    },
    async ({ workspacePath, task, includeMemory, includeGraph }) =>
      textResult(
        await prepareContext(config, {
          workspacePath,
          task,
          includeMemory: includeMemory ?? false,
          includeGraph: includeGraph ?? false,
        }),
      ),
  );

  server.tool(
    "get_handoff",
    "Return only the latest HANDOFF.md for fast continuation when switching editors.",
    {
      workspacePath: z.string().optional(),
      projectId: z.string().optional(),
    },
    async ({ workspacePath, projectId }) => {
      const id = resolveProjectId(config, { workspacePath, projectId });
      return textResult(readHandoff(config, id));
    },
  );

  server.tool(
    "update_handoff",
    "Update the durable handoff after meaningful work so the next editor/session can continue.",
    {
      workspacePath: z.string().optional(),
      projectId: z.string().optional(),
      currentTask: z.string().optional(),
      completed: z.array(z.string()).optional(),
      filesChanged: z.array(z.string()).optional(),
      decision: z.string().optional(),
      validation: z.string().optional(),
      remaining: z.string().optional(),
      editor: z.string().optional(),
    },
    async (args) => {
      const id = resolveProjectId(config, {
        workspacePath: args.workspacePath,
        projectId: args.projectId,
      });
      const content = updateHandoff(config, id, args);
      return textResult(content);
    },
  );

  server.tool(
    "update_project_state",
    "Patch durable PROJECT_STATE sections and optionally append decisions/constraints.",
    {
      workspacePath: z.string().optional(),
      projectId: z.string().optional(),
      technology: z.string().optional(),
      architecture: z.string().optional(),
      currentWork: z.string().optional(),
      recentChanges: z.string().optional(),
      importantDecisions: z.string().optional(),
      constraints: z.string().optional(),
      validation: z.string().optional(),
      knownIssues: z.string().optional(),
      nextAction: z.string().optional(),
      appendDecision: z.string().optional(),
      appendConstraint: z.string().optional(),
    },
    async (args) => {
      const id = resolveProjectId(config, {
        workspacePath: args.workspacePath,
        projectId: args.projectId,
      });
      const result = updateProjectState(config, id, args);
      return textResult(
        JSON.stringify(
          {
            projectId: id,
            updated: Object.keys(args).filter(
              (k) => k !== "workspacePath" && k !== "projectId" && (args as Record<string, unknown>)[k] !== undefined,
            ),
            preview: result.projectState.slice(0, 1500),
          },
          null,
          2,
        ),
      );
    },
  );

  server.tool(
    "list_projects",
    "List all registered projects in the AI Coding System registry.",
    {},
    async () => {
      const projects = listProjects(config).map((p) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        workspacePath: p.workspacePath,
        gitRemote: p.gitRemote,
        updatedAt: p.updatedAt,
        lastEditor: p.lastEditor,
      }));
      return textResult(JSON.stringify(projects, null, 2));
    },
  );

  server.tool(
    "get_git_summary",
    "Read-only git summary for a workspace (branch, dirty files, recent commits).",
    {
      workspacePath: z.string().describe("Absolute workspace path"),
    },
    async ({ workspacePath }) => {
      return textResult(formatGitSummary(getGitSummary(workspacePath)));
    },
  );

  server.tool(
    "doctor",
    "Check AI Coding System health, including optional provider status.",
    {},
    async () => {
      const result = runDoctor(config);
      return textResult(
        `${result.ok ? "HEALTHY" : "ISSUES FOUND"}\n\n${result.summary}`,
      );
    },
  );

  server.tool(
    "provider_status",
    "Return configuration and local availability status for all optional providers.",
    {},
    async () =>
      textResult(JSON.stringify(getAllProviderStatuses(config), null, 2)),
  );

  server.tool(
    "decide_tools",
    "Use Von (System One) to pick the next ACS tool or peer action for a task. Call when unsure which tool to use; then call only the recommended tool (or Reticle peer tools if recommended). If escalate is true, choose manually.",
    {
      task: z.string().min(1).describe("Current task / user intent"),
      workspacePath: z
        .string()
        .optional()
        .describe("Optional workspace for project-state hint"),
      hints: z
        .string()
        .optional()
        .describe("Optional extra constraints for the decision"),
    },
    async ({ task, workspacePath, hints }) =>
      textResult(
        JSON.stringify(
          await decideTools(config, { task, workspacePath, hints }),
          null,
          2,
        ),
      ),
  );

  server.tool(
    "decide_gate",
    "Binary Von (noul) confidence gate for a yes/no question over state. escalate is true when probability is below von.confidenceThreshold.",
    {
      state: z.string().min(1).describe("State document / task description"),
      question: z
        .string()
        .min(1)
        .describe("Yes/no question, e.g. Should we run a security scan?"),
    },
    async ({ state, question }) =>
      textResult(
        JSON.stringify(await decideGate(config, { state, question }), null, 2),
      ),
  );

  server.tool(
    "reticle_guidance",
    "Return Reticle peer-MCP setup checklist and verification loop. Reticle tools are not proxied through ACS; use the reticle MCP server on the owned app.",
    {},
    async () => textResult(getReticleGuidance(config)),
  );

  server.tool(
    "seo_guidance",
    "SEO-first Next.js guidance using next-seo. Pass user keywords so agents ship generateMetadata + JSON-LD in the same change as content (not later).",
    {
      keywords: z
        .string()
        .optional()
        .describe(
          "Comma-separated primary/secondary keywords from the user",
        ),
      workspacePath: z
        .string()
        .optional()
        .describe("Next.js app workspace to probe for next-seo"),
      pageType: z
        .enum([
          "article",
          "organization",
          "product",
          "faq",
          "howto",
          "website",
        ])
        .optional()
        .describe("Content type for JSON-LD component selection"),
    },
    async ({ keywords, workspacePath, pageType }) =>
      textResult(
        getSeoGuidance(config, { keywords, workspacePath, pageType }),
      ),
  );

  server.tool(
    "list_acs_skills",
    "List Anthropic-style ACS task skills under skills/ (Task 14 template layout; not a full anthropics/skills clone).",
    {},
    async () => textResult(formatAcsSkills(config)),
  );

  server.tool(
    "memory_search",
    "Search the optional Claude-Mem index and return compact results with observation IDs. Claude-Mem is selective memory only; ACS remains the source of truth.",
    {
      query: z.string().min(1).describe("Memory search query"),
      limit: z.number().int().min(1).max(100).optional().default(10),
    },
    async ({ query, limit }) =>
      textResult(await memorySearch(config, query, limit ?? 10)),
  );

  server.tool(
    "memory_get",
    "Fetch full Claude-Mem details only for explicitly selected observation IDs.",
    {
      ids: z
        .array(z.number().int().positive())
        .describe("Claude-Mem observation IDs to retrieve"),
    },
    async ({ ids }) => textResult(await memoryGet(config, ids)),
  );

  server.tool(
    "discipline_rules",
    "Return compact Ponytail YAGNI ladder and safety carve-outs for implementation discipline.",
    {},
    async () => textResult(getDisciplineRules(config)),
  );

  server.tool(
    "compression_guidance",
    "Return compression policy guidance: Caveman terse-output hints when caveman.enabled, plus Context Mode tool-context notes. Both roles may be enabled together.",
    {},
    async () => textResult(getCavemanGuidance(config)),
  );

  server.tool(
    "quality_detect",
    "Detect Prettier and ESLint configuration in a workspace. Reports formatter/linter and conflicts.",
    {
      workspacePath: z.string().describe("Absolute workspace path"),
    },
    async ({ workspacePath }) =>
      textResult(JSON.stringify(detectQualityStack(workspacePath), null, 2)),
  );

  server.tool(
    "quality_check",
    "Run non-conflicting quality tools detected in the workspace (Prettier/ESLint). Output truncated to 4k chars.",
    {
      workspacePath: z.string().describe("Absolute workspace path"),
    },
    async ({ workspacePath }) => textResult(runQualityCheck(workspacePath)),
  );

  server.tool(
    "review_diff",
    "Run OpenCodeReview against the current workspace diff and save JSON output in the project reviews directory.",
    {
      workspacePath: z.string().describe("Absolute workspace path"),
      projectId: z.string().optional(),
    },
    async ({ workspacePath, projectId }) => {
      const id = resolveProjectId(config, { workspacePath, projectId });
      return textResult(
        runOpenCodeReview(config, {
          workspacePath,
          projectId: id,
          mode: "diff",
        }),
      );
    },
  );

  server.tool(
    "review_scan",
    "Run an OpenCodeReview workspace scan and save JSON output in the project reviews directory.",
    {
      workspacePath: z.string().describe("Absolute workspace path"),
      projectId: z.string().optional(),
    },
    async ({ workspacePath, projectId }) => {
      const id = resolveProjectId(config, { workspacePath, projectId });
      return textResult(
        runOpenCodeReview(config, {
          workspacePath,
          projectId: id,
          mode: "scan",
        }),
      );
    },
  );

  server.tool(
    "security_refs",
    "Return compact OWASP secure-coding excerpts for a topic (input-validation, auth, session, crypto, injection, access-control, config, general).",
    {
      topic: z
        .string()
        .describe(
          "Security topic: input-validation, auth, session, crypto, injection, access-control, config, general",
        ),
      maxChars: z
        .number()
        .optional()
        .default(2000)
        .describe("Maximum characters to return (default 2000)"),
    },
    async ({ topic, maxChars }) =>
      textResult(securityRefs(config, topic, maxChars ?? 2000)),
  );

  server.tool(
    "security_scan",
    "Run the configured security scanners by policy. Light runs Semgrep; normal adds review guidance; deep also runs enabled CodeQL. Findings are capped at 3k characters.",
    {
      workspacePath: z.string().describe("Absolute workspace path"),
      policy: z.enum(["light", "normal", "deep"]).optional(),
    },
    async ({ workspacePath, policy }) =>
      textResult(runSecurityScan(config, { workspacePath, policy })),
  );

  server.tool(
    "finalize_task",
    "Run the end-of-task checklist: git summary, build validation, requested quality/security/review checks, handoff update, and managed session-temp cleanup.",
    {
      workspacePath: z.string().describe("Absolute workspace path"),
      projectId: z.string().optional(),
      sessionId: z
        .string()
        .optional()
        .describe("Managed session identifier to clean after finalization"),
      qualityCheck: z.boolean().optional().default(false),
      securityScan: z.boolean().optional().default(false),
      securityPolicy: z.enum(["light", "normal", "deep"]).optional(),
      review: z.boolean().optional().default(false),
      currentTask: z.string().optional(),
      completed: z.array(z.string()).optional(),
      filesChanged: z.array(z.string()).optional(),
      decision: z.string().optional(),
      validation: z.string().optional(),
      remaining: z.string().optional(),
      editor: z.string().optional(),
    },
    async (args) => textResult(finalizeTask(config, args)),
  );

  // Always register graph tools so the MCP surface is complete; degrade with hints
  // when Graphify is disabled in config or the CLI is missing.
  server.tool(
    "graph_query",
    "Query Graphify knowledge graph for the workspace (optional; requires graphify CLI).",
    {
      workspacePath: z.string(),
      question: z.string(),
    },
    async ({ workspacePath, question }) => {
      if (!config.graphify.enabled) {
        return textResult(
          "Graphify is disabled in config/system.json (graphify.enabled=false).",
        );
      }
      if (!isGraphifyAvailable()) {
        return textResult(
          "Graphify not installed. Install: uv tool install graphifyy\nThen: graphify extract . --code-only",
        );
      }
      registerProject(config, { workspacePath });
      return textResult(graphQuery(workspacePath, question));
    },
  );

  server.tool(
    "graph_explain",
    "Explain a symbol/node via Graphify (optional; requires graphify CLI).",
    {
      workspacePath: z.string(),
      symbol: z.string(),
    },
    async ({ workspacePath, symbol }) => {
      if (!config.graphify.enabled) {
        return textResult(
          "Graphify is disabled in config/system.json (graphify.enabled=false).",
        );
      }
      if (!isGraphifyAvailable()) {
        return textResult(
          "Graphify not installed. Install: uv tool install graphifyy",
        );
      }
      return textResult(graphExplain(workspacePath, symbol));
    },
  );

  server.tool(
    "graph_index",
    "Build or refresh Graphify index for a workspace (code-only by default).",
    {
      workspacePath: z.string(),
      codeOnly: z.boolean().optional().default(true),
    },
    async ({ workspacePath, codeOnly }) => {
      if (!config.graphify.enabled) {
        return textResult(
          "Graphify is disabled in config/system.json (graphify.enabled=false).",
        );
      }
      if (!isGraphifyAvailable()) {
        return textResult(
          "Graphify not installed. Install: uv tool install graphifyy",
        );
      }
      return textResult(graphExtract(workspacePath, codeOnly ?? true));
    },
  );

  return server;
}
