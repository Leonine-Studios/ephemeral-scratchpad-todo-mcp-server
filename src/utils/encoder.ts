import { Todo, Session } from "../storage/types.js";
import {
  encodeTodosToTonl,
  encodeTodoToTonl,
  encodeSessionToTonl,
  encodeScratchpadToTonl,
} from "./tonl.js";

/**
 * Response format type
 */
export type ResponseFormat = "json" | "tonl";

/**
 * Get the configured response format from environment
 */
export function getResponseFormat(): ResponseFormat {
  const format = process.env.RESPONSE_FORMAT?.toLowerCase();
  if (format === "tonl") {
    return "tonl";
  }
  return "json"; // Default to JSON
}

/**
 * Response encoder that supports both JSON and TONL formats
 */
export class ResponseEncoder {
  private format: ResponseFormat;

  constructor(format?: ResponseFormat) {
    this.format = format ?? getResponseFormat();
  }

  /**
   * Get the current format
   */
  getFormat(): ResponseFormat {
    return this.format;
  }

  /**
   * Encode a list of todos
   */
  encodeTodos(todos: Todo[]): string {
    if (this.format === "tonl") {
      return encodeTodosToTonl(todos);
    }

    // JSON format
    return JSON.stringify(
      todos.map((todo) => ({
        id: todo.id,
        title: todo.title,
        description: todo.description,
        status: todo.status,
        tags: todo.tags,
        createdAt: todo.createdAt.toISOString(),
      })),
      null,
      2
    );
  }

  /**
   * Encode a single todo
   */
  encodeTodo(todo: Todo): string {
    if (this.format === "tonl") {
      return encodeTodoToTonl(todo);
    }

    // JSON format
    return JSON.stringify(
      {
        id: todo.id,
        title: todo.title,
        description: todo.description,
        status: todo.status,
        tags: todo.tags,
        createdAt: todo.createdAt.toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Encode session info (for init_session response)
   */
  encodeSession(session: Session): string {
    if (this.format === "tonl") {
      return encodeSessionToTonl(session);
    }

    // JSON format
    return JSON.stringify(
      {
        session_id: session.id,
        user_id: session.userId,
        scratchpad: session.scratchpad,
        todos: session.todos.map((todo) => ({
          id: todo.id,
          title: todo.title,
          description: todo.description,
          status: todo.status,
          tags: todo.tags,
          createdAt: todo.createdAt.toISOString(),
        })),
        created_at: session.createdAt.toISOString(),
        last_modified: session.lastModified.toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Encode scratchpad content
   */
  encodeScratchpad(sessionId: string, content: string): string {
    if (this.format === "tonl") {
      return encodeScratchpadToTonl(sessionId, content);
    }

    // JSON format
    return JSON.stringify(
      {
        session_id: sessionId,
        content_length: content.length,
        content: content,
      },
      null,
      2
    );
  }

  /**
   * Encode a simple success response
   */
  encodeSuccess(message: string, data?: Record<string, unknown>): string {
    if (this.format === "tonl") {
      const lines = ["{success, message}"];
      lines.push(`success: true`);
      lines.push(`message: ${message}`);
      if (data) {
        for (const [key, value] of Object.entries(data)) {
          lines.push(`${key}: ${String(value)}`);
        }
      }
      return lines.join("\n");
    }

    // JSON format
    return JSON.stringify(
      {
        success: true,
        message,
        ...data,
      },
      null,
      2
    );
  }

  /**
   * Encode an error response
   */
  encodeError(error: string, code?: string): string {
    if (this.format === "tonl") {
      const lines = ["{error, code}"];
      lines.push(`error: ${error}`);
      if (code) {
        lines.push(`code: ${code}`);
      }
      return lines.join("\n");
    }

    // JSON format
    return JSON.stringify(
      {
        error,
        code,
      },
      null,
      2
    );
  }
}

/**
 * Global encoder instance (uses environment config)
 */
let globalEncoder: ResponseEncoder | null = null;

/**
 * Get the global encoder instance
 */
export function getEncoder(): ResponseEncoder {
  if (!globalEncoder) {
    globalEncoder = new ResponseEncoder();
  }
  return globalEncoder;
}

/**
 * Reset the global encoder (useful for testing)
 */
export function resetEncoder(): void {
  globalEncoder = null;
}
