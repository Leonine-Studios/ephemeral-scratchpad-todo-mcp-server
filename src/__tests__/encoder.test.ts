import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ResponseEncoder,
  getResponseFormat,
  resetEncoder,
} from "../utils/encoder.js";
import { Todo, Session } from "../storage/types.js";

describe("ResponseEncoder", () => {
  const sampleTodo: Todo = {
    id: "todo-123",
    title: "Test Task",
    description: "A test description",
    tags: ["test", "sample"],
    status: "pending",
    createdAt: new Date("2025-01-18T10:00:00Z"),
  };

  const sampleTodos: Todo[] = [
    sampleTodo,
    {
      id: "todo-456",
      title: "Another Task",
      description: "",
      tags: [],
      status: "done",
      createdAt: new Date("2025-01-18T11:00:00Z"),
    },
  ];

  const sampleSession: Session = {
    id: "session-abc",
    userId: "user-123",
    scratchpad: "Working notes here",
    todos: sampleTodos,
    createdAt: new Date("2025-01-18T09:00:00Z"),
    lastModified: new Date("2025-01-18T12:00:00Z"),
  };

  describe("JSON format", () => {
    let encoder: ResponseEncoder;

    beforeEach(() => {
      encoder = new ResponseEncoder("json");
    });

    it("should return json as format", () => {
      expect(encoder.getFormat()).toBe("json");
    });

    it("should encode single todo as JSON", () => {
      const result = encoder.encodeTodo(sampleTodo);
      const parsed = JSON.parse(result);

      expect(parsed.id).toBe("todo-123");
      expect(parsed.title).toBe("Test Task");
      expect(parsed.description).toBe("A test description");
      expect(parsed.tags).toEqual(["test", "sample"]);
      expect(parsed.status).toBe("pending");
      expect(parsed.createdAt).toBe("2025-01-18T10:00:00.000Z");
    });

    it("should encode todo list as JSON array", () => {
      const result = encoder.encodeTodos(sampleTodos);
      const parsed = JSON.parse(result);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
      expect(parsed[0].id).toBe("todo-123");
      expect(parsed[1].id).toBe("todo-456");
    });

    it("should encode empty todo list as empty JSON array", () => {
      const result = encoder.encodeTodos([]);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual([]);
    });

    it("should encode session as JSON", () => {
      const result = encoder.encodeSession(sampleSession);
      const parsed = JSON.parse(result);

      expect(parsed.session_id).toBe("session-abc");
      expect(parsed.user_id).toBe("user-123");
      expect(parsed.scratchpad).toBe("Working notes here");
      expect(parsed.todos.length).toBe(2);
    });

    it("should encode scratchpad as JSON", () => {
      const result = encoder.encodeScratchpad("session-123", "Hello World");
      const parsed = JSON.parse(result);

      expect(parsed.session_id).toBe("session-123");
      expect(parsed.content).toBe("Hello World");
      expect(parsed.content_length).toBe(11);
    });

    it("should encode success response as JSON", () => {
      const result = encoder.encodeSuccess("Operation successful", {
        count: 5,
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe("Operation successful");
      expect(parsed.count).toBe(5);
    });

    it("should encode error response as JSON", () => {
      const result = encoder.encodeError("Something went wrong", "ERR_001");
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe("Something went wrong");
      expect(parsed.code).toBe("ERR_001");
    });
  });

  describe("TONL format", () => {
    let encoder: ResponseEncoder;

    beforeEach(() => {
      encoder = new ResponseEncoder("tonl");
    });

    it("should return tonl as format", () => {
      expect(encoder.getFormat()).toBe("tonl");
    });

    it("should encode single todo as TONL", () => {
      const result = encoder.encodeTodo(sampleTodo);

      expect(result).toContain("{id, title, description, status, tags, createdAt}");
      expect(result).toContain("id: todo-123");
      expect(result).toContain("title: Test Task");
      expect(result).toContain("description: A test description");
      expect(result).toContain("status: pending");
      expect(result).toContain("tags: [test,sample]");
      expect(result).toContain("createdAt: 2025-01-18");
    });

    it("should encode todo list as TONL table", () => {
      const result = encoder.encodeTodos(sampleTodos);

      expect(result).toContain("[2]{id, title, status, tags, createdAt}");
      expect(result).toContain("todo-123");
      expect(result).toContain("todo-456");
      expect(result).toContain("Test Task");
      expect(result).toContain("Another Task");
      expect(result).toContain("pending");
      expect(result).toContain("done");
    });

    it("should encode empty todo list as TONL with zero count", () => {
      const result = encoder.encodeTodos([]);

      expect(result).toBe("[0]{id, title, status, tags, createdAt}");
    });

    it("should encode session as TONL", () => {
      const result = encoder.encodeSession(sampleSession);

      expect(result).toContain("{id, userId, scratchpadLength, todoCount, createdAt, lastModified}");
      expect(result).toContain("id: session-abc");
      expect(result).toContain("userId: user-123");
      expect(result).toContain("scratchpadLength: 18");
      expect(result).toContain("todoCount: 2");
    });

    it("should encode scratchpad as TONL", () => {
      const result = encoder.encodeScratchpad("session-123", "Hello World");

      expect(result).toContain("{sessionId, contentLength, content}");
      expect(result).toContain("sessionId: session-123");
      expect(result).toContain("contentLength: 11");
      expect(result).toContain("content:");
      expect(result).toContain("Hello World");
    });

    it("should encode success response as TONL", () => {
      const result = encoder.encodeSuccess("Operation successful", {
        count: 5,
      });

      expect(result).toContain("{success, message}");
      expect(result).toContain("success: true");
      expect(result).toContain("message: Operation successful");
      expect(result).toContain("count: 5");
    });

    it("should encode error response as TONL", () => {
      const result = encoder.encodeError("Something went wrong", "ERR_001");

      expect(result).toContain("{error, code}");
      expect(result).toContain("error: Something went wrong");
      expect(result).toContain("code: ERR_001");
    });
  });

  describe("Special characters handling", () => {
    it("should escape special characters in TONL", () => {
      const todoWithSpecialChars: Todo = {
        id: "todo-special",
        title: "Task with\nnewline and\ttab",
        description: "Has | pipe",
        tags: ["tag1", "tag2"],
        status: "pending",
        createdAt: new Date("2025-01-18"),
      };

      const encoder = new ResponseEncoder("tonl");
      const result = encoder.encodeTodo(todoWithSpecialChars);

      // Should escape newlines and tabs
      expect(result).toContain("\\n");
      expect(result).toContain("\\t");
      expect(result).toContain("\\|");
    });
  });

  describe("getResponseFormat", () => {
    const originalEnv = process.env.RESPONSE_FORMAT;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.RESPONSE_FORMAT = originalEnv;
      } else {
        delete process.env.RESPONSE_FORMAT;
      }
      resetEncoder();
    });

    it("should return json by default", () => {
      delete process.env.RESPONSE_FORMAT;
      expect(getResponseFormat()).toBe("json");
    });

    it("should return json when set to json", () => {
      process.env.RESPONSE_FORMAT = "json";
      expect(getResponseFormat()).toBe("json");
    });

    it("should return tonl when set to tonl", () => {
      process.env.RESPONSE_FORMAT = "tonl";
      expect(getResponseFormat()).toBe("tonl");
    });

    it("should return tonl when set to TONL (case insensitive)", () => {
      process.env.RESPONSE_FORMAT = "TONL";
      expect(getResponseFormat()).toBe("tonl");
    });

    it("should default to json for unknown values", () => {
      process.env.RESPONSE_FORMAT = "unknown";
      expect(getResponseFormat()).toBe("json");
    });
  });
});
