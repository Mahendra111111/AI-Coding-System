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
import { getCavemanGuidance } from "../providers/caveman.js";
import { securityRefs } from "../providers/owasp.js";
import { getDisciplineRules } from "../providers/ponytail.js";
import { getAllProviderStatuses } from "../providers/status.js";

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
    "discipline_rules",
    "Return compact Ponytail YAGNI ladder and safety carve-outs for implementation discipline.",
    {},
    async () => textResult(getDisciplineRules(config)),
  );

  server.tool(
    "compression_guidance",
    "Return active compression guidance (context-mode vs caveman) and terse-output hints when caveman is enabled.",
    {},
    async () => textResult(getCavemanGuidance(config)),
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

  if (config.graphify.enabled) {
    server.tool(
      "graph_query",
      "Query Graphify knowledge graph for the workspace (optional; requires graphify CLI).",
      {
        workspacePath: z.string(),
        question: z.string(),
      },
      async ({ workspacePath, question }) => {
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
        if (!isGraphifyAvailable()) {
          return textResult(
            "Graphify not installed. Install: uv tool install graphifyy",
          );
        }
        return textResult(graphExtract(workspacePath, codeOnly ?? true));
      },
    );
  }

  return server;
}
