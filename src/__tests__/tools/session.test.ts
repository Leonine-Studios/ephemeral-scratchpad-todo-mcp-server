import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InMemorySessionStore } from "../../storage/InMemorySessionStore.js";
import { ResponseEncoder } from "../../utils/encoder.js";
import { initSession, ToolContext } from "../../tools/session.js";

describe("init_session tool", () => {
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

  describe("session creation", () => {
    it("should create a new session", async () => {
      const context = createContext();
      const result = await initSession({}, context);
      const parsed = JSON.parse(result);

      expect(parsed.session_id).toBeDefined();
      expect(parsed.session_id.length).toBe(21);
      expect(parsed.scratchpad).toBe("");
      expect(parsed.todos).toEqual([]);
    });

    it("should create session with unique IDs", async () => {
      const context = createContext();

      const result1 = await initSession({}, context);
      const result2 = await initSession({}, context);
      const result3 = await initSession({}, context);

      const id1 = JSON.parse(result1).session_id;
      const id2 = JSON.parse(result2).session_id;
      const id3 = JSON.parse(result3).session_id;

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it("should include userId when X-User-ID header is provided", async () => {
      const context = createContext("user-abc");
      const result = await initSession({}, context);
      const parsed = JSON.parse(result);

      expect(parsed.user_id).toBe("user-abc");
    });

    it("should have null userId when no X-User-ID header", async () => {
      const context = createContext();
      const result = await initSession({}, context);
      const parsed = JSON.parse(result);

      expect(parsed.user_id).toBeUndefined();
    });
  });

  describe("TONL format", () => {
    it("should output session in TONL format", async () => {
      const tonlEncoder = new ResponseEncoder("tonl");
      const context: ToolContext = { store, encoder: tonlEncoder, userId: "user-123" };

      const result = await initSession({}, context);

      expect(result).toContain("{id, userId, scratchpadLength, todoCount, createdAt, lastModified}");
      expect(result).toContain("userId: user-123");
      expect(result).toContain("scratchpadLength: 0");
      expect(result).toContain("todoCount: 0");
    });
  });

  describe("session persistence", () => {
    it("should persist session in store", async () => {
      const context = createContext();
      const result = await initSession({}, context);
      const parsed = JSON.parse(result);

      const session = await store.get(parsed.session_id);
      expect(session).not.toBeNull();
      expect(session?.id).toBe(parsed.session_id);
    });

    it("should increment session count", async () => {
      const context = createContext();

      expect(await store.count()).toBe(0);

      await initSession({}, context);
      expect(await store.count()).toBe(1);

      await initSession({}, context);
      expect(await store.count()).toBe(2);
    });
  });
});
