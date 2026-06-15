import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const demoTargets = [
  "src/components/todo-list",
  "src/components/notifications",
  "src/app/api/todos",
  "src/lib/api/todos.ts",
  "src/lib/db/schema/todos.ts",
  "src/lib/db/queries/todos.ts",
  "src/lib/db/migrations",
  "src/lib/mcp/tools",
];

const exportCleanupFiles = [
  "src/lib/api/index.ts",
  "src/lib/db/queries/index.ts",
  "src/lib/db/schema/index.ts",
];

const CLEAN_MCP_SERVER = `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function buildMcpServer(_userId: string): McpServer {
  const server = new McpServer({
    name: "kickoff-3d-mcp",
    version: "1.0.0",
  });

  // Register your tools here.

  return server;
}
`;

const fileRewrites: Array<{
  relPath: string;
  contents: string;
  createIfMissing?: boolean;
}> = [
  { relPath: "src/lib/mcp/server.ts", contents: CLEAN_MCP_SERVER },
];

function resolveFromRoot(relPath: string): string {
  return path.join(ROOT, relPath);
}

function removePath(relPath: string) {
  const absPath = resolveFromRoot(relPath);
  if (!existsSync(absPath)) {
    console.log(`- skip (not found): ${relPath}`);
    return;
  }

  rmSync(absPath, { recursive: true, force: true });
  console.log(`- removed: ${relPath}`);
}

function cleanupTodosExport(relPath: string) {
  const absPath = resolveFromRoot(relPath);
  if (!existsSync(absPath)) {
    console.log(`- skip export cleanup (not found): ${relPath}`);
    return;
  }

  const original = readFileSync(absPath, "utf8");
  const next = original
    .split("\n")
    .filter((line) => !/^\s*export\s+\*\s+from\s+["']\.\/todos["'];?\s*$/.test(line))
    .join("\n")
    .trimEnd();

  const finalContent = next.length > 0 ? `${next}\n` : "";
  if (finalContent !== original) {
    writeFileSync(absPath, finalContent, "utf8");
    console.log(`- cleaned exports: ${relPath}`);
  } else {
    console.log(`- no export changes: ${relPath}`);
  }
}

function rewriteFile({
  relPath,
  contents,
  createIfMissing = false,
}: {
  relPath: string;
  contents: string;
  createIfMissing?: boolean;
}) {
  const absPath = resolveFromRoot(relPath);
  if (!existsSync(absPath)) {
    if (!createIfMissing) {
      console.log(`- skip rewrite (not found): ${relPath}`);
      return;
    }
    mkdirSync(path.dirname(absPath), { recursive: true });
    writeFileSync(absPath, contents, "utf8");
    console.log(`- created: ${relPath}`);
    return;
  }

  const original = readFileSync(absPath, "utf8");
  if (original === contents) {
    console.log(`- already clean: ${relPath}`);
    return;
  }

  writeFileSync(absPath, contents, "utf8");
  console.log(`- rewrote: ${relPath}`);
}

function main() {
  console.log("Cleaning template demo artifacts...");
  demoTargets.forEach(removePath);

  console.log("Fixing stale index exports...");
  exportCleanupFiles.forEach(cleanupTodosExport);

  console.log("Rewriting files that referenced demo modules...");
  fileRewrites.forEach(rewriteFile);

  console.log("Done. Demo cleanup completed.");
}

main();
