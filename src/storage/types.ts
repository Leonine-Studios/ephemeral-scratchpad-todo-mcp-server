/**
 * Todo status enumeration
 */
export type TodoStatus = "pending" | "done";

/**
 * Todo item within a session
 */
export interface Todo {
  id: string; // NanoID
  title: string;
  description: string;
  tags: string[];
  status: TodoStatus;
  createdAt: Date;
}

/**
 * Session data structure
 */
export interface Session {
  id: string; // NanoID
  userId?: string; // Optional, from X-User-ID header
  scratchpad: string;
  todos: Todo[];
  createdAt: Date;
  lastModified: Date;
}

/**
 * Error thrown when session is not found
 */
export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = "SessionNotFoundError";
  }
}

/**
 * Error thrown when user ID validation fails
 */
export class UserIdMismatchError extends Error {
  constructor(sessionId: string) {
    super(`User ID mismatch for session: ${sessionId}`);
    this.name = "UserIdMismatchError";
  }
}

/**
 * Error thrown when todo is not found
 */
export class TodoNotFoundError extends Error {
  constructor(todoId: string, sessionId: string) {
    super(`Todo not found: ${todoId} in session: ${sessionId}`);
    this.name = "TodoNotFoundError";
  }
}

/**
 * Abstract interface for session storage
 * Allows swapping implementations (InMemory, Redis, etc.)
 */
export interface SessionStore {
  /**
   * Create a new session
   * @param userId - Optional user ID from X-User-ID header
   * @returns The created session
   */
  create(userId?: string): Promise<Session>;

  /**
   * Get a session by ID
   * @param sessionId - The session ID
   * @param userId - Optional user ID for validation
   * @returns The session or null if not found
   * @throws UserIdMismatchError if session has userId and it doesn't match
   */
  get(sessionId: string, userId?: string): Promise<Session | null>;

  /**
   * Update a session
   * @param sessionId - The session ID
   * @param updates - Partial session updates
   * @param userId - Optional user ID for validation
   * @throws SessionNotFoundError if session doesn't exist
   * @throws UserIdMismatchError if session has userId and it doesn't match
   */
  update(
    sessionId: string,
    updates: Partial<Omit<Session, "id" | "createdAt">>,
    userId?: string
  ): Promise<void>;

  /**
   * Delete a session
   * @param sessionId - The session ID
   * @param userId - Optional user ID for validation
   * @throws SessionNotFoundError if session doesn't exist
   * @throws UserIdMismatchError if session has userId and it doesn't match
   */
  delete(sessionId: string, userId?: string): Promise<void>;

  /**
   * Check if a session ID exists
   * @param sessionId - The session ID to check
   * @returns True if exists, false otherwise
   */
  exists(sessionId: string): Promise<boolean>;

  /**
   * Get session count (useful for monitoring)
   */
  count(): Promise<number>;

  /**
   * Cleanup expired sessions (called by background task)
   * @returns Number of sessions cleaned up
   */
  cleanup(): Promise<number>;

  /**
   * Start the background cleanup task
   */
  startCleanup(): void;

  /**
   * Stop the background cleanup task
   */
  stopCleanup(): void;
}
