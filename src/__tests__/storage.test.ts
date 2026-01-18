import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InMemorySessionStore } from "../storage/InMemorySessionStore.js";
import { UserIdMismatchError, SessionNotFoundError } from "../storage/types.js";

describe("InMemorySessionStore", () => {
  let store: InMemorySessionStore;

  beforeEach(() => {
    store = new InMemorySessionStore({
      ttlHours: 1,
      cleanupIntervalMs: 60000,
      nanoidLength: 21,
    });
  });

  afterEach(() => {
    store.stopCleanup();
  });

  describe("create", () => {
    it("should create a new session with NanoID", async () => {
      const session = await store.create();

      expect(session.id).toBeDefined();
      expect(session.id.length).toBe(21);
      expect(session.scratchpad).toBe("");
      expect(session.todos).toEqual([]);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastModified).toBeInstanceOf(Date);
    });

    it("should create session with userId when provided", async () => {
      const session = await store.create("user-123");

      expect(session.userId).toBe("user-123");
    });

    it("should create session without userId when not provided", async () => {
      const session = await store.create();

      expect(session.userId).toBeUndefined();
    });

    it("should generate unique session IDs", async () => {
      const sessions = await Promise.all([
        store.create(),
        store.create(),
        store.create(),
      ]);

      const ids = sessions.map((s) => s.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(3);
    });
  });

  describe("NanoID collision handling", () => {
    it("should have collision check mechanism in place", async () => {
      // Create first session
      const session1 = await store.create();

      // The store should have the session
      expect(await store.exists(session1.id)).toBe(true);

      // Creating more sessions should work (collision is extremely unlikely)
      const session2 = await store.create();
      expect(session2.id).not.toBe(session1.id);
    });
  });

  describe("get", () => {
    it("should return session by ID", async () => {
      const created = await store.create();
      const retrieved = await store.get(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it("should return null for non-existent session", async () => {
      const session = await store.get("non-existent-id");

      expect(session).toBeNull();
    });

    it("should validate userId if session has one", async () => {
      const session = await store.create("user-123");

      // Correct userId
      const retrieved = await store.get(session.id, "user-123");
      expect(retrieved).not.toBeNull();

      // Wrong userId
      await expect(store.get(session.id, "wrong-user")).rejects.toThrow(
        UserIdMismatchError
      );

      // Missing userId
      await expect(store.get(session.id, undefined)).rejects.toThrow(
        UserIdMismatchError
      );
    });

    it("should not require userId if session has none", async () => {
      const session = await store.create();

      // No userId provided - should work
      const retrieved = await store.get(session.id);
      expect(retrieved).not.toBeNull();

      // With userId provided - should also work
      const retrieved2 = await store.get(session.id, "any-user");
      expect(retrieved2).not.toBeNull();
    });
  });

  describe("update", () => {
    it("should update session scratchpad", async () => {
      const session = await store.create();
      await store.update(session.id, { scratchpad: "Hello World" });

      const retrieved = await store.get(session.id);
      expect(retrieved?.scratchpad).toBe("Hello World");
    });

    it("should update lastModified on update", async () => {
      const session = await store.create();
      const originalLastModified = session.lastModified;

      // Wait a bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await store.update(session.id, { scratchpad: "Updated" });
      const retrieved = await store.get(session.id);

      expect(retrieved?.lastModified.getTime()).toBeGreaterThan(
        originalLastModified.getTime()
      );
    });

    it("should throw SessionNotFoundError for non-existent session", async () => {
      await expect(
        store.update("non-existent", { scratchpad: "test" })
      ).rejects.toThrow(SessionNotFoundError);
    });

    it("should validate userId on update", async () => {
      const session = await store.create("user-123");

      await expect(
        store.update(session.id, { scratchpad: "test" }, "wrong-user")
      ).rejects.toThrow(UserIdMismatchError);
    });
  });

  describe("delete", () => {
    it("should delete session", async () => {
      const session = await store.create();
      await store.delete(session.id);

      const retrieved = await store.get(session.id);
      expect(retrieved).toBeNull();
    });

    it("should throw SessionNotFoundError for non-existent session", async () => {
      await expect(store.delete("non-existent")).rejects.toThrow(
        SessionNotFoundError
      );
    });

    it("should validate userId on delete", async () => {
      const session = await store.create("user-123");

      await expect(store.delete(session.id, "wrong-user")).rejects.toThrow(
        UserIdMismatchError
      );
    });
  });

  describe("exists", () => {
    it("should return true for existing session", async () => {
      const session = await store.create();

      expect(await store.exists(session.id)).toBe(true);
    });

    it("should return false for non-existent session", async () => {
      expect(await store.exists("non-existent")).toBe(false);
    });
  });

  describe("count", () => {
    it("should return correct session count", async () => {
      expect(await store.count()).toBe(0);

      await store.create();
      expect(await store.count()).toBe(1);

      await store.create();
      expect(await store.count()).toBe(2);
    });
  });

  describe("TTL expiration", () => {
    it("should return null for expired session", async () => {
      // Create store with very short TTL
      const shortTtlStore = new InMemorySessionStore({
        ttlHours: 0.0001, // ~0.36 seconds
        cleanupIntervalMs: 100,
      });

      const session = await shortTtlStore.create();

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 500));

      const retrieved = await shortTtlStore.get(session.id);
      expect(retrieved).toBeNull();

      shortTtlStore.stopCleanup();
    });

    it("should cleanup expired sessions", async () => {
      const shortTtlStore = new InMemorySessionStore({
        ttlHours: 0.0001,
        cleanupIntervalMs: 100,
      });

      await shortTtlStore.create();
      await shortTtlStore.create();

      expect(await shortTtlStore.count()).toBe(2);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 500));

      const cleaned = await shortTtlStore.cleanup();
      expect(cleaned).toBe(2);
      expect(await shortTtlStore.count()).toBe(0);

      shortTtlStore.stopCleanup();
    });
  });

  describe("cleanup lifecycle", () => {
    it("should start and stop cleanup without errors", () => {
      store.startCleanup();
      store.startCleanup(); // Should be idempotent
      store.stopCleanup();
      store.stopCleanup(); // Should be idempotent
    });
  });

  describe("clear", () => {
    it("should clear all sessions", async () => {
      await store.create();
      await store.create();
      await store.create();

      expect(await store.count()).toBe(3);

      await store.clear();

      expect(await store.count()).toBe(0);
    });
  });
});
