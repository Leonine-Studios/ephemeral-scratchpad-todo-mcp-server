import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InMemorySessionStore } from "../../storage/InMemorySessionStore.js";
import { ResponseEncoder } from "../../utils/encoder.js";
import { ToolContext } from "../../tools/session.js";
import {
  addTodo,
  listTodos,
  updateTodo,
  deleteTodo,
} from "../../tools/todo.js";

describe("todo tools", () => {
  let store: InMemorySessionStore;
  let encoder: ResponseEncoder;

  beforeEach(() => {
    store = new InMemorySessionStore({ ttlHours: 1 });
    encoder = new ResponseEncoder("json");
  });

  afterEach(() => {
    store.stopCleanup();
  });

  function createContext(userId?: string): ToolContext {
    return { store, encoder, userId };
  }

  describe("add_todo", () => {
    it("should add a todo with all fields", async () => {
      const session = await store.create();
      const context = createContext();

      const result = await addTodo(
        {
          session_id: session.id,
          title: "Test Task",
          description: "A description",
          tags: ["test", "sample"],
        },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.id).toBeDefined();
      expect(parsed.id.length).toBe(12); // Shorter NanoID for todos
      expect(parsed.title).toBe("Test Task");
      expect(parsed.description).toBe("A description");
      expect(parsed.tags).toEqual(["test", "sample"]);
      expect(parsed.status).toBe("pending");
    });

    it("should add a todo with minimal fields", async () => {
      const session = await store.create();
      const context = createContext();

      const result = await addTodo(
        {
          session_id: session.id,
          title: "Minimal Task",
        },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.title).toBe("Minimal Task");
      expect(parsed.description).toBe("");
      expect(parsed.tags).toEqual([]);
      expect(parsed.status).toBe("pending");
    });

    it("should persist todo to session", async () => {
      const session = await store.create();
      const context = createContext();

      await addTodo({ session_id: session.id, title: "Task 1" }, context);
      await addTodo({ session_id: session.id, title: "Task 2" }, context);

      const updated = await store.get(session.id);
      expect(updated?.todos.length).toBe(2);
      expect(updated?.todos[0].title).toBe("Task 1");
      expect(updated?.todos[1].title).toBe("Task 2");
    });

    it("should return error for non-existent session", async () => {
      const context = createContext();

      const result = await addTodo(
        { session_id: "non-existent", title: "Test" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.code).toBe("SESSION_NOT_FOUND");
    });

    it("should validate userId", async () => {
      const session = await store.create("user-123");
      const context = createContext("wrong-user");

      const result = await addTodo(
        { session_id: session.id, title: "Test" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.code).toBe("USER_ID_MISMATCH");
    });
  });

  describe("list_todos", () => {
    async function setupTodos(sessionId: string, context: ToolContext) {
      await addTodo({ session_id: sessionId, title: "Task 1" }, context);
      await addTodo({ session_id: sessionId, title: "Task 2" }, context);
      await addTodo({ session_id: sessionId, title: "Task 3" }, context);

      // Mark Task 2 as done
      const session = await store.get(sessionId);
      const todoId = session!.todos[1].id;
      await updateTodo(
        { session_id: sessionId, todo_id: todoId, status: "done" },
        context
      );
    }

    it("should list all todos", async () => {
      const session = await store.create();
      const context = createContext();
      await setupTodos(session.id, context);

      const result = await listTodos(
        { session_id: session.id, filter: "all" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.length).toBe(3);
    });

    it("should filter pending todos", async () => {
      const session = await store.create();
      const context = createContext();
      await setupTodos(session.id, context);

      const result = await listTodos(
        { session_id: session.id, filter: "pending" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.length).toBe(2);
      expect(parsed.every((t: { status: string }) => t.status === "pending")).toBe(true);
    });

    it("should filter done todos", async () => {
      const session = await store.create();
      const context = createContext();
      await setupTodos(session.id, context);

      const result = await listTodos(
        { session_id: session.id, filter: "done" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.length).toBe(1);
      expect(parsed[0].status).toBe("done");
    });

    it("should default to all filter", async () => {
      const session = await store.create();
      const context = createContext();
      await setupTodos(session.id, context);

      const result = await listTodos({ session_id: session.id }, context);
      const parsed = JSON.parse(result);

      expect(parsed.length).toBe(3);
    });

    it("should return empty array for session with no todos", async () => {
      const session = await store.create();
      const context = createContext();

      const result = await listTodos({ session_id: session.id }, context);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual([]);
    });

    it("should return error for non-existent session", async () => {
      const context = createContext();

      const result = await listTodos({ session_id: "non-existent" }, context);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.code).toBe("SESSION_NOT_FOUND");
    });
  });

  describe("update_todo", () => {
    it("should update todo status to done", async () => {
      const session = await store.create();
      const context = createContext();
      await addTodo({ session_id: session.id, title: "Test" }, context);

      const todos = (await store.get(session.id))!.todos;
      const todoId = todos[0].id;

      const result = await updateTodo(
        { session_id: session.id, todo_id: todoId, status: "done" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe("done");

      // Verify persistence
      const updated = await store.get(session.id);
      expect(updated?.todos[0].status).toBe("done");
    });

    it("should update todo status back to pending", async () => {
      const session = await store.create();
      const context = createContext();
      await addTodo({ session_id: session.id, title: "Test" }, context);

      const todos = (await store.get(session.id))!.todos;
      const todoId = todos[0].id;

      await updateTodo(
        { session_id: session.id, todo_id: todoId, status: "done" },
        context
      );
      await updateTodo(
        { session_id: session.id, todo_id: todoId, status: "pending" },
        context
      );

      const updated = await store.get(session.id);
      expect(updated?.todos[0].status).toBe("pending");
    });

    it("should return error for non-existent todo", async () => {
      const session = await store.create();
      const context = createContext();

      const result = await updateTodo(
        { session_id: session.id, todo_id: "non-existent", status: "done" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.code).toBe("TODO_NOT_FOUND");
    });

    it("should return error for non-existent session", async () => {
      const context = createContext();

      const result = await updateTodo(
        { session_id: "non-existent", todo_id: "any", status: "done" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.code).toBe("SESSION_NOT_FOUND");
    });

    it("should validate userId", async () => {
      const session = await store.create("user-123");
      const context = createContext("wrong-user");

      const result = await updateTodo(
        { session_id: session.id, todo_id: "any", status: "done" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.code).toBe("USER_ID_MISMATCH");
    });
  });

  describe("delete_todo", () => {
    it("should delete a todo", async () => {
      const session = await store.create();
      const context = createContext();
      await addTodo({ session_id: session.id, title: "To Delete" }, context);

      const todos = (await store.get(session.id))!.todos;
      const todoId = todos[0].id;

      const result = await deleteTodo(
        { session_id: session.id, todo_id: todoId },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.deleted_id).toBe(todoId);
      expect(parsed.deleted_title).toBe("To Delete");

      // Verify deletion
      const updated = await store.get(session.id);
      expect(updated?.todos.length).toBe(0);
    });

    it("should delete correct todo from list", async () => {
      const session = await store.create();
      const context = createContext();
      await addTodo({ session_id: session.id, title: "Task 1" }, context);
      await addTodo({ session_id: session.id, title: "Task 2" }, context);
      await addTodo({ session_id: session.id, title: "Task 3" }, context);

      const todos = (await store.get(session.id))!.todos;
      const todoToDelete = todos[1]; // Delete middle todo

      await deleteTodo(
        { session_id: session.id, todo_id: todoToDelete.id },
        context
      );

      const updated = await store.get(session.id);
      expect(updated?.todos.length).toBe(2);
      expect(updated?.todos[0].title).toBe("Task 1");
      expect(updated?.todos[1].title).toBe("Task 3");
    });

    it("should return error for non-existent todo", async () => {
      const session = await store.create();
      const context = createContext();

      const result = await deleteTodo(
        { session_id: session.id, todo_id: "non-existent" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.code).toBe("TODO_NOT_FOUND");
    });

    it("should return error for non-existent session", async () => {
      const context = createContext();

      const result = await deleteTodo(
        { session_id: "non-existent", todo_id: "any" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.code).toBe("SESSION_NOT_FOUND");
    });

    it("should validate userId", async () => {
      const session = await store.create("user-123");
      const context = createContext("wrong-user");

      const result = await deleteTodo(
        { session_id: session.id, todo_id: "any" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.code).toBe("USER_ID_MISMATCH");
    });
  });

  describe("TONL format", () => {
    it("should output todo list in TONL format", async () => {
      const tonlEncoder = new ResponseEncoder("tonl");
      const session = await store.create();
      const context: ToolContext = { store, encoder: tonlEncoder };

      await addTodo({ session_id: session.id, title: "Task 1" }, context);
      await addTodo({ session_id: session.id, title: "Task 2" }, context);

      const result = await listTodos({ session_id: session.id }, context);

      expect(result).toContain("[2]{id, title, status, tags, createdAt}");
      expect(result).toContain("Task 1");
      expect(result).toContain("Task 2");
      expect(result).toContain("pending");
    });

    it("should output single todo in TONL format", async () => {
      const tonlEncoder = new ResponseEncoder("tonl");
      const session = await store.create();
      const context: ToolContext = { store, encoder: tonlEncoder };

      const result = await addTodo(
        {
          session_id: session.id,
          title: "TONL Task",
          description: "Description",
          tags: ["tag1", "tag2"],
        },
        context
      );

      expect(result).toContain("{id, title, description, status, tags, createdAt}");
      expect(result).toContain("title: TONL Task");
      expect(result).toContain("description: Description");
      expect(result).toContain("tags: [tag1,tag2]");
      expect(result).toContain("status: pending");
    });
  });
});
