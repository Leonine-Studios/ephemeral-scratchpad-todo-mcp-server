import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InMemorySessionStore } from "../storage/InMemorySessionStore.js";
import { ResponseEncoder } from "../utils/encoder.js";
import { ToolContext, initSession } from "../tools/session.js";
import { readScratchpad, writeScratchpad } from "../tools/scratchpad.js";
import { addTodo, listTodos, updateTodo, deleteTodo } from "../tools/todo.js";

describe("Integration Tests", () => {
  let store: InMemorySessionStore;
  let jsonEncoder: ResponseEncoder;
  let tonlEncoder: ResponseEncoder;

  beforeEach(() => {
    store = new InMemorySessionStore({ ttlHours: 1 });
    jsonEncoder = new ResponseEncoder("json");
    tonlEncoder = new ResponseEncoder("tonl");
  });

  afterEach(() => {
    store.stopCleanup();
  });

  describe("Full workflow: init → add todos → update → list → delete", () => {
    it("should complete full workflow with JSON format", async () => {
      const context: ToolContext = { store, encoder: jsonEncoder };

      // 1. Initialize session
      const initResult = await initSession({}, context);
      const session = JSON.parse(initResult);
      expect(session.session_id).toBeDefined();

      // 2. Add todos
      const todo1Result = await addTodo(
        {
          session_id: session.session_id,
          title: "First Task",
          description: "Do something",
          tags: ["important"],
        },
        context
      );
      const todo1 = JSON.parse(todo1Result);
      expect(todo1.id).toBeDefined();
      expect(todo1.status).toBe("pending");

      const todo2Result = await addTodo(
        {
          session_id: session.session_id,
          title: "Second Task",
        },
        context
      );
      const todo2 = JSON.parse(todo2Result);

      // 3. List all todos
      const listResult = await listTodos(
        { session_id: session.session_id },
        context
      );
      const allTodos = JSON.parse(listResult);
      expect(allTodos.length).toBe(2);

      // 4. Update first todo to done
      const updateResult = await updateTodo(
        {
          session_id: session.session_id,
          todo_id: todo1.id,
          status: "done",
        },
        context
      );
      const updatedTodo = JSON.parse(updateResult);
      expect(updatedTodo.status).toBe("done");

      // 5. List pending todos
      const pendingResult = await listTodos(
        { session_id: session.session_id, filter: "pending" },
        context
      );
      const pendingTodos = JSON.parse(pendingResult);
      expect(pendingTodos.length).toBe(1);
      expect(pendingTodos[0].id).toBe(todo2.id);

      // 6. Delete second todo
      const deleteResult = await deleteTodo(
        { session_id: session.session_id, todo_id: todo2.id },
        context
      );
      const deleted = JSON.parse(deleteResult);
      expect(deleted.success).toBe(true);

      // 7. Verify final state
      const finalResult = await listTodos(
        { session_id: session.session_id },
        context
      );
      const finalTodos = JSON.parse(finalResult);
      expect(finalTodos.length).toBe(1);
      expect(finalTodos[0].status).toBe("done");
    });

    it("should complete full workflow with TONL format", async () => {
      const context: ToolContext = { store, encoder: tonlEncoder };

      // 1. Initialize session
      const initResult = await initSession({}, context);
      expect(initResult).toContain("{id, userId, scratchpadLength, todoCount");

      // Extract session ID from TONL output
      const idMatch = initResult.match(/id: (\S+)/);
      expect(idMatch).not.toBeNull();
      const sessionId = idMatch![1];

      // 2. Add todos
      const todo1Result = await addTodo(
        {
          session_id: sessionId,
          title: "TONL Task",
          tags: ["test"],
        },
        context
      );
      expect(todo1Result).toContain("title: TONL Task");
      expect(todo1Result).toContain("status: pending");

      // 3. List todos - should be in table format
      const listResult = await listTodos({ session_id: sessionId }, context);
      expect(listResult).toContain("[1]{id, title, status, tags, createdAt}");
      expect(listResult).toContain("TONL Task");
    });
  });

  describe("Scratchpad and todo combined workflow", () => {
    it("should manage scratchpad alongside todos", async () => {
      const context: ToolContext = { store, encoder: jsonEncoder };

      // Initialize
      const session = JSON.parse(await initSession({}, context));

      // Write initial notes
      await writeScratchpad(
        {
          session_id: session.session_id,
          content: "## Working Notes\n- Start with task analysis",
        },
        context
      );

      // Add some todos based on analysis
      await addTodo(
        {
          session_id: session.session_id,
          title: "Analyze requirements",
        },
        context
      );

      // Update notes with findings
      await writeScratchpad(
        {
          session_id: session.session_id,
          content:
            "## Working Notes\n- Start with task analysis\n- Found 3 key requirements\n- Need to validate with stakeholder",
        },
        context
      );

      // Add more todos
      const todo2Result = await addTodo(
        {
          session_id: session.session_id,
          title: "Validate requirements",
          tags: ["stakeholder"],
        },
        context
      );
      const todo2 = JSON.parse(todo2Result);

      // Complete first task, update notes
      const todos = JSON.parse(
        await listTodos({ session_id: session.session_id }, context)
      );
      await updateTodo(
        {
          session_id: session.session_id,
          todo_id: todos[0].id,
          status: "done",
        },
        context
      );

      await writeScratchpad(
        {
          session_id: session.session_id,
          content:
            "## Working Notes\n- ✅ Analysis complete\n- Found 3 key requirements\n- ⏳ Waiting for stakeholder validation",
        },
        context
      );

      // Verify final state
      const finalScratchpad = JSON.parse(
        await readScratchpad({ session_id: session.session_id }, context)
      );
      expect(finalScratchpad.content).toContain("✅ Analysis complete");

      const finalTodos = JSON.parse(
        await listTodos({ session_id: session.session_id }, context)
      );
      expect(finalTodos.length).toBe(2);
      expect(finalTodos.filter((t: { status: string }) => t.status === "done").length).toBe(1);
    });
  });

  describe("Multi-session isolation", () => {
    it("should isolate data between sessions", async () => {
      const context: ToolContext = { store, encoder: jsonEncoder };

      // Create two sessions
      const session1 = JSON.parse(await initSession({}, context));
      const session2 = JSON.parse(await initSession({}, context));

      // Add data to session 1
      await writeScratchpad(
        { session_id: session1.session_id, content: "Session 1 notes" },
        context
      );
      await addTodo(
        { session_id: session1.session_id, title: "Session 1 task" },
        context
      );

      // Add data to session 2
      await writeScratchpad(
        { session_id: session2.session_id, content: "Session 2 notes" },
        context
      );
      await addTodo(
        { session_id: session2.session_id, title: "Session 2 task" },
        context
      );

      // Verify isolation
      const scratchpad1 = JSON.parse(
        await readScratchpad({ session_id: session1.session_id }, context)
      );
      const scratchpad2 = JSON.parse(
        await readScratchpad({ session_id: session2.session_id }, context)
      );

      expect(scratchpad1.content).toBe("Session 1 notes");
      expect(scratchpad2.content).toBe("Session 2 notes");

      const todos1 = JSON.parse(
        await listTodos({ session_id: session1.session_id }, context)
      );
      const todos2 = JSON.parse(
        await listTodos({ session_id: session2.session_id }, context)
      );

      expect(todos1.length).toBe(1);
      expect(todos1[0].title).toBe("Session 1 task");
      expect(todos2.length).toBe(1);
      expect(todos2[0].title).toBe("Session 2 task");
    });
  });

  describe("X-User-ID security validation", () => {
    it("should enforce user ID binding across all operations", async () => {
      // Create session with user ID
      const userContext: ToolContext = {
        store,
        encoder: jsonEncoder,
        userId: "user-secure",
      };
      const session = JSON.parse(await initSession({}, userContext));

      // Operations with correct user ID should succeed
      await writeScratchpad(
        { session_id: session.session_id, content: "Secure notes" },
        userContext
      );
      await addTodo(
        { session_id: session.session_id, title: "Secure task" },
        userContext
      );

      const todos = JSON.parse(
        await listTodos({ session_id: session.session_id }, userContext)
      );
      expect(todos.length).toBe(1);

      // Operations with wrong user ID should fail
      const wrongUserContext: ToolContext = {
        store,
        encoder: jsonEncoder,
        userId: "wrong-user",
      };

      const readResult = JSON.parse(
        await readScratchpad({ session_id: session.session_id }, wrongUserContext)
      );
      expect(readResult.code).toBe("USER_ID_MISMATCH");

      const listResult = JSON.parse(
        await listTodos({ session_id: session.session_id }, wrongUserContext)
      );
      expect(listResult.code).toBe("USER_ID_MISMATCH");

      // Operations without user ID should also fail
      const noUserContext: ToolContext = { store, encoder: jsonEncoder };

      const noUserResult = JSON.parse(
        await readScratchpad({ session_id: session.session_id }, noUserContext)
      );
      expect(noUserResult.code).toBe("USER_ID_MISMATCH");
    });

    it("should allow any access to sessions without user ID", async () => {
      // Create session without user ID
      const noUserContext: ToolContext = { store, encoder: jsonEncoder };
      const session = JSON.parse(await initSession({}, noUserContext));

      // Any user should be able to access
      const randomUserContext: ToolContext = {
        store,
        encoder: jsonEncoder,
        userId: "random-user",
      };

      await writeScratchpad(
        { session_id: session.session_id, content: "Open notes" },
        randomUserContext
      );

      const scratchpad = JSON.parse(
        await readScratchpad({ session_id: session.session_id }, randomUserContext)
      );
      expect(scratchpad.content).toBe("Open notes");

      // Different user can also access
      const anotherUserContext: ToolContext = {
        store,
        encoder: jsonEncoder,
        userId: "another-user",
      };

      const readResult = JSON.parse(
        await readScratchpad({ session_id: session.session_id }, anotherUserContext)
      );
      expect(readResult.content).toBe("Open notes");
    });
  });

  describe("TTL expiration behavior", () => {
    it("should expire sessions after TTL", async () => {
      // Create store with very short TTL
      const shortTtlStore = new InMemorySessionStore({
        ttlHours: 0.0001, // ~0.36 seconds
      });

      const context: ToolContext = { store: shortTtlStore, encoder: jsonEncoder };

      // Create session and add data
      const session = JSON.parse(await initSession({}, context));
      await writeScratchpad(
        { session_id: session.session_id, content: "Will expire" },
        context
      );
      await addTodo(
        { session_id: session.session_id, title: "Expiring task" },
        context
      );

      // Verify data exists
      const scratchpad = JSON.parse(
        await readScratchpad({ session_id: session.session_id }, context)
      );
      expect(scratchpad.content).toBe("Will expire");

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Session should be expired
      const expiredResult = JSON.parse(
        await readScratchpad({ session_id: session.session_id }, context)
      );
      expect(expiredResult.code).toBe("SESSION_NOT_FOUND");

      shortTtlStore.stopCleanup();
    });

    it("should update lastModified on activity", async () => {
      // Create store with short TTL but enough time for test
      const shortTtlStore = new InMemorySessionStore({
        ttlHours: 0.001, // ~3.6 seconds
      });

      const context: ToolContext = { store: shortTtlStore, encoder: jsonEncoder };

      // Create session
      const session = JSON.parse(await initSession({}, context));

      // Keep session alive with activity
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await writeScratchpad(
          { session_id: session.session_id, content: `Update ${i}` },
          context
        );
      }

      // Session should still be alive due to activity
      const stillAlive = JSON.parse(
        await readScratchpad({ session_id: session.session_id }, context)
      );
      expect(stillAlive.content).toBe("Update 2");

      shortTtlStore.stopCleanup();
    });
  });

  describe("Error handling", () => {
    it("should handle all error cases gracefully", async () => {
      const context: ToolContext = { store, encoder: jsonEncoder };

      // Non-existent session
      const noSession = JSON.parse(
        await readScratchpad({ session_id: "fake-id" }, context)
      );
      expect(noSession.error).toBeDefined();
      expect(noSession.code).toBe("SESSION_NOT_FOUND");

      // Create valid session
      const session = JSON.parse(await initSession({}, context));

      // Non-existent todo
      const noTodo = JSON.parse(
        await updateTodo(
          { session_id: session.session_id, todo_id: "fake-todo", status: "done" },
          context
        )
      );
      expect(noTodo.error).toBeDefined();
      expect(noTodo.code).toBe("TODO_NOT_FOUND");

      // Delete non-existent todo
      const deleteNoTodo = JSON.parse(
        await deleteTodo(
          { session_id: session.session_id, todo_id: "fake-todo" },
          context
        )
      );
      expect(deleteNoTodo.error).toBeDefined();
      expect(deleteNoTodo.code).toBe("TODO_NOT_FOUND");
    });
  });
});
