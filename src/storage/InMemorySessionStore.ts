import { nanoid } from "nanoid";
import {
  Session,
  SessionStore,
  SessionNotFoundError,
  UserIdMismatchError,
} from "./types.js";

/**
 * Configuration for InMemorySessionStore
 */
export interface InMemorySessionStoreConfig {
  /**
   * Time-to-live for sessions in hours
   * @default 24
   */
  ttlHours?: number;

  /**
   * Cleanup interval in milliseconds
   * @default 3600000 (1 hour)
   */
  cleanupIntervalMs?: number;

  /**
   * Length of generated NanoIDs
   * @default 21
   */
  nanoidLength?: number;
}

/**
 * In-memory implementation of SessionStore
 * Features:
 * - NanoID generation with collision check
 * - Background TTL cleanup
 * - Optional User ID validation
 */
export class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly ttlMs: number;
  private readonly cleanupIntervalMs: number;
  private readonly nanoidLength: number;

  constructor(config: InMemorySessionStoreConfig = {}) {
    const ttlHours = config.ttlHours ?? 24;
    this.ttlMs = ttlHours * 60 * 60 * 1000;
    this.cleanupIntervalMs = config.cleanupIntervalMs ?? 60 * 60 * 1000; // 1 hour
    this.nanoidLength = config.nanoidLength ?? 21;
  }

  /**
   * Generate a unique NanoID with collision check
   */
  private async generateUniqueId(): Promise<string> {
    let id: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      id = nanoid(this.nanoidLength);
      attempts++;

      if (attempts > maxAttempts) {
        throw new Error(
          "Failed to generate unique session ID after maximum attempts"
        );
      }
    } while (await this.exists(id));

    return id;
  }

  /**
   * Validate user ID if session has one set
   */
  private validateUserId(session: Session, userId?: string): void {
    // If session was created with a userId, validate it
    if (session.userId !== undefined) {
      if (userId === undefined || session.userId !== userId) {
        throw new UserIdMismatchError(session.id);
      }
    }
    // If session has no userId, any request is allowed (backwards compatible)
  }

  /**
   * Check if a session is expired
   */
  private isExpired(session: Session): boolean {
    const now = Date.now();
    const sessionAge = now - session.lastModified.getTime();
    return sessionAge > this.ttlMs;
  }

  async create(userId?: string): Promise<Session> {
    const id = await this.generateUniqueId();
    const now = new Date();

    const session: Session = {
      id,
      userId,
      scratchpad: "",
      todos: [],
      createdAt: now,
      lastModified: now,
    };

    this.sessions.set(id, session);
    return session;
  }

  async get(sessionId: string, userId?: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if expired
    if (this.isExpired(session)) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Validate user ID
    this.validateUserId(session, userId);

    return session;
  }

  async update(
    sessionId: string,
    updates: Partial<Omit<Session, "id" | "createdAt">>,
    userId?: string
  ): Promise<void> {
    const session = await this.get(sessionId, userId);

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // Apply updates
    const updatedSession: Session = {
      ...session,
      ...updates,
      lastModified: new Date(),
    };

    this.sessions.set(sessionId, updatedSession);
  }

  async delete(sessionId: string, userId?: string): Promise<void> {
    const session = await this.get(sessionId, userId);

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    this.sessions.delete(sessionId);
  }

  async exists(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Also check expiration
    if (this.isExpired(session)) {
      this.sessions.delete(sessionId);
      return false;
    }

    return true;
  }

  async count(): Promise<number> {
    return this.sessions.size;
  }

  async cleanup(): Promise<number> {
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (this.isExpired(session)) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[SessionStore] Cleaned up ${cleanedCount} expired sessions`);
    }

    return cleanedCount;
  }

  startCleanup(): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    console.log(
      `[SessionStore] Starting background cleanup (interval: ${this.cleanupIntervalMs}ms, TTL: ${this.ttlMs}ms)`
    );

    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch((err) => {
        console.error("[SessionStore] Cleanup error:", err);
      });
    }, this.cleanupIntervalMs);

    // Don't prevent process exit
    this.cleanupInterval.unref();
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log("[SessionStore] Stopped background cleanup");
    }
  }

  /**
   * Clear all sessions (useful for testing)
   */
  async clear(): Promise<void> {
    this.sessions.clear();
  }
}
