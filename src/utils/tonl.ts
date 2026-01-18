import { Todo, Session } from "../storage/types.js";

/**
 * TONL (Token-Optimized Notation Language) encoder
 * Reduces token usage by 30-60% compared to JSON for structured data
 *
 * Format:
 * - Arrays: [count]{field1, field2, ...} followed by data rows
 * - Objects: {field1, field2, ...} followed by field: value pairs
 */

/**
 * Escape special characters in TONL values
 */
function escapeValue(value: string): string {
  // Escape tabs, newlines, and pipes which have special meaning in TONL
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\n")
    .replace(/\|/g, "\\|");
}

/**
 * Format a date for TONL output (ISO date without time for brevity)
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Format tags array for TONL
 */
function formatTags(tags: string[]): string {
  if (tags.length === 0) {
    return "[]";
  }
  return `[${tags.join(",")}]`;
}

/**
 * Calculate column widths for aligned TONL output
 */
function calculateColumnWidths(
  todos: Todo[],
  columns: string[]
): Map<string, number> {
  const widths = new Map<string, number>();

  // Initialize with header widths
  for (const col of columns) {
    widths.set(col, col.length);
  }

  // Calculate max width for each column
  for (const todo of todos) {
    const values = getTodoValues(todo);
    for (const col of columns) {
      const value = values.get(col) ?? "";
      const currentWidth = widths.get(col) ?? 0;
      widths.set(col, Math.max(currentWidth, value.length));
    }
  }

  return widths;
}

/**
 * Get todo field values as a map
 */
function getTodoValues(todo: Todo): Map<string, string> {
  return new Map([
    ["id", todo.id],
    ["title", escapeValue(todo.title)],
    ["description", escapeValue(todo.description)],
    ["status", todo.status],
    ["tags", formatTags(todo.tags)],
    ["createdAt", formatDate(todo.createdAt)],
  ]);
}

/**
 * Encode a list of todos in TONL format
 *
 * Example output:
 * [3]{id, title, status, tags, createdAt}
 * abc123   Task 1       done      [backend]     2025-01-18
 * def456   Task 2       pending   [frontend]    2025-01-18
 */
export function encodeTodosToTonl(todos: Todo[]): string {
  if (todos.length === 0) {
    return "[0]{id, title, status, tags, createdAt}";
  }

  const columns = ["id", "title", "status", "tags", "createdAt"];
  const widths = calculateColumnWidths(todos, columns);

  // Header line
  const header = `[${todos.length}]{${columns.join(", ")}}`;

  // Data rows
  const rows = todos.map((todo) => {
    const values = getTodoValues(todo);
    return columns
      .map((col) => {
        const value = values.get(col) ?? "";
        const width = widths.get(col) ?? value.length;
        return value.padEnd(width);
      })
      .join("   "); // Three spaces between columns
  });

  return [header, ...rows].join("\n");
}

/**
 * Encode a single todo in TONL format
 */
export function encodeTodoToTonl(todo: Todo): string {
  const lines = [
    "{id, title, description, status, tags, createdAt}",
    `id: ${todo.id}`,
    `title: ${escapeValue(todo.title)}`,
    `description: ${escapeValue(todo.description)}`,
    `status: ${todo.status}`,
    `tags: ${formatTags(todo.tags)}`,
    `createdAt: ${formatDate(todo.createdAt)}`,
  ];

  return lines.join("\n");
}

/**
 * Encode session info in TONL format (used by init_session)
 */
export function encodeSessionToTonl(session: Session): string {
  const lines = [
    "{id, userId, scratchpadLength, todoCount, createdAt, lastModified}",
    `id: ${session.id}`,
    `userId: ${session.userId ?? "(none)"}`,
    `scratchpadLength: ${session.scratchpad.length}`,
    `todoCount: ${session.todos.length}`,
    `createdAt: ${formatDate(session.createdAt)}`,
    `lastModified: ${formatDate(session.lastModified)}`,
  ];

  return lines.join("\n");
}

/**
 * Encode scratchpad content in TONL format
 * For scratchpad, we just wrap it with metadata
 */
export function encodeScratchpadToTonl(
  sessionId: string,
  content: string
): string {
  const lines = [
    "{sessionId, contentLength, content}",
    `sessionId: ${sessionId}`,
    `contentLength: ${content.length}`,
    "content:",
    content,
  ];

  return lines.join("\n");
}
