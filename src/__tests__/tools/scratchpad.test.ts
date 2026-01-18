import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InMemorySessionStore } from "../../storage/InMemorySessionStore.js";
import { ResponseEncoder } from "../../utils/encoder.js";
import { ToolContext } from "../../tools/session.js";
import { readScratchpad, writeScratchpad } from "../../tools/scratchpad.js";

describe("scratchpad tools", () => {
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

  describe("read_scratchpad", () => {
    it("should read empty scratchpad from new session", async () => {
      const session = await store.create();
      const context = createContext();

      const result = await readScratchpad({ session_id: session.id }, context);
      const parsed = JSON.parse(result);

      expect(parsed.session_id).toBe(session.id);
      expect(parsed.content).toBe("");
      expect(parsed.content_length).toBe(0);
    });

    it("should read scratchpad content", async () => {
      const session = await store.create();
      await store.update(session.id, { scratchpad: "Hello World" });
      const context = createContext();

      const result = await readScratchpad({ session_id: session.id }, context);
      const parsed = JSON.parse(result);

      expect(parsed.content).toBe("Hello World");
      expect(parsed.content_length).toBe(11);
    });

    it("should return error for non-existent session", async () => {
      const context = createContext();

      const result = await readScratchpad(
        { session_id: "non-existent" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.code).toBe("SESSION_NOT_FOUND");
    });

    it("should validate userId for session with userId", async () => {
      const session = await store.create("user-123");
      const context = createContext("wrong-user");

      const result = await readScratchpad({ session_id: session.id }, context);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.code).toBe("USER_ID_MISMATCH");
    });

    it("should allow access with correct userId", async () => {
      const session = await store.create("user-123");
      const context = createContext("user-123");

      const result = await readScratchpad({ session_id: session.id }, context);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeUndefined();
      expect(parsed.session_id).toBe(session.id);
    });
  });

  describe("write_scratchpad", () => {
    it("should write content to scratchpad", async () => {
      const session = await store.create();
      const context = createContext();

      const result = await writeScratchpad(
        { session_id: session.id, content: "New content" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.content_length).toBe(11);

      // Verify content was saved
      const updated = await store.get(session.id);
      expect(updated?.scratchpad).toBe("New content");
    });

    it("should overwrite existing scratchpad content", async () => {
      const session = await store.create();
      await store.update(session.id, { scratchpad: "Original" });
      const context = createContext();

      await writeScratchpad(
        { session_id: session.id, content: "Replaced" },
        context
      );

      const updated = await store.get(session.id);
      expect(updated?.scratchpad).toBe("Replaced");
    });

    it("should handle multiline content", async () => {
      const session = await store.create();
      const context = createContext();
      const multilineContent = `# Notes
- Point 1
- Point 2

## Details
Some details here`;

      await writeScratchpad(
        { session_id: session.id, content: multilineContent },
        context
      );

      const updated = await store.get(session.id);
      expect(updated?.scratchpad).toBe(multilineContent);
    });

    it("should return error for non-existent session", async () => {
      const context = createContext();

      const result = await writeScratchpad(
        { session_id: "non-existent", content: "test" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.code).toBe("SESSION_NOT_FOUND");
    });

    it("should validate userId for session with userId", async () => {
      const session = await store.create("user-123");
      const context = createContext("wrong-user");

      const result = await writeScratchpad(
        { session_id: session.id, content: "test" },
        context
      );
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.code).toBe("USER_ID_MISMATCH");
    });
  });

  describe("TONL format", () => {
    it("should output scratchpad in TONL format", async () => {
      const tonlEncoder = new ResponseEncoder("tonl");
      const session = await store.create();
      await store.update(session.id, { scratchpad: "Test content" });

      const context: ToolContext = { store, encoder: tonlEncoder };
      const result = await readScratchpad({ session_id: session.id }, context);

      expect(result).toContain("{sessionId, contentLength, content}");
      expect(result).toContain(`sessionId: ${session.id}`);
      expect(result).toContain("contentLength: 12");
      expect(result).toContain("content:");
      expect(result).toContain("Test content");
    });

    it("should output success in TONL format", async () => {
      const tonlEncoder = new ResponseEncoder("tonl");
      const session = await store.create();

      const context: ToolContext = { store, encoder: tonlEncoder };
      const result = await writeScratchpad(
        { session_id: session.id, content: "TONL test" },
        context
      );

      expect(result).toContain("success: true");
      expect(result).toContain("message: Scratchpad updated successfully");
    });
  });
});
