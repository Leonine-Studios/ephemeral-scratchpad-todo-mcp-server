import { z } from "zod";
import { SessionStore } from "../storage/types.js";
import { ResponseEncoder } from "../utils/encoder.js";

/**
 * Schema for init_session tool input
 * No required parameters - userId is extracted from X-User-ID header
 */
export const InitSessionInputSchema = z.object({});

export type InitSessionInput = z.infer<typeof InitSessionInputSchema>;

/**
 * Context passed to tool handlers
 */
export interface ToolContext {
  store: SessionStore;
  encoder: ResponseEncoder;
  userId?: string; // From X-User-ID header
}

/**
 * Initialize a new session
 * Creates a fresh session with empty scratchpad and todo list
 * If X-User-ID header is present, session is bound to that user
 */
export async function initSession(
  _input: InitSessionInput,
  context: ToolContext
): Promise<string> {
  const session = await context.store.create(context.userId);
  return context.encoder.encodeSession(session);
}

/**
 * Tool definition for MCP registration
 */
export const initSessionTool = {
  name: "init_session",
  description: `Initialize a new ephemeral session with a scratchpad and todo list.

Returns a unique session_id that must be used for all subsequent operations.

If X-User-ID header is provided by the client, the session is bound to that user 
for additional security - all future requests must include the same X-User-ID.

Sessions automatically expire after the configured TTL (default: 24 hours).`,
  inputSchema: InitSessionInputSchema,
  handler: initSession,
};
