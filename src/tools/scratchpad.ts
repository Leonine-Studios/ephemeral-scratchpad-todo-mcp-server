import { z } from "zod";
import { SessionNotFoundError, UserIdMismatchError } from "../storage/types.js";
import { ToolContext } from "./session.js";

/**
 * Schema for read_scratchpad tool input
 */
export const ReadScratchpadInputSchema = z.object({
  session_id: z.string().describe("The session ID returned by init_session"),
});

export type ReadScratchpadInput = z.infer<typeof ReadScratchpadInputSchema>;

/**
 * Schema for write_scratchpad tool input
 */
export const WriteScratchpadInputSchema = z.object({
  session_id: z.string().describe("The session ID returned by init_session"),
  content: z
    .string()
    .describe("The content to write to the scratchpad (replaces existing content)"),
});

export type WriteScratchpadInput = z.infer<typeof WriteScratchpadInputSchema>;

/**
 * Read the scratchpad content for a session
 */
export async function readScratchpad(
  input: ReadScratchpadInput,
  context: ToolContext
): Promise<string> {
  try {
    const session = await context.store.get(input.session_id, context.userId);

    if (!session) {
      return context.encoder.encodeError(
        `Session not found: ${input.session_id}`,
        "SESSION_NOT_FOUND"
      );
    }

    return context.encoder.encodeScratchpad(session.id, session.scratchpad);
  } catch (error) {
    if (error instanceof UserIdMismatchError) {
      return context.encoder.encodeError(
        "User ID mismatch - access denied",
        "USER_ID_MISMATCH"
      );
    }
    throw error;
  }
}

/**
 * Write content to the scratchpad (replaces existing content)
 */
export async function writeScratchpad(
  input: WriteScratchpadInput,
  context: ToolContext
): Promise<string> {
  try {
    await context.store.update(
      input.session_id,
      { scratchpad: input.content },
      context.userId
    );

    return context.encoder.encodeSuccess("Scratchpad updated successfully", {
      session_id: input.session_id,
      content_length: input.content.length,
    });
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      return context.encoder.encodeError(
        `Session not found: ${input.session_id}`,
        "SESSION_NOT_FOUND"
      );
    }
    if (error instanceof UserIdMismatchError) {
      return context.encoder.encodeError(
        "User ID mismatch - access denied",
        "USER_ID_MISMATCH"
      );
    }
    throw error;
  }
}

/**
 * Tool definitions for MCP registration
 */
export const readScratchpadTool = {
  name: "read_scratchpad",
  description: `Read the current content of the session's scratchpad.

The scratchpad is a freeform text area for storing working notes, intermediate findings, 
reasoning trails, or any other contextual information during agent workflows.

Returns the scratchpad content along with session metadata.`,
  inputSchema: ReadScratchpadInputSchema,
  handler: readScratchpad,
};

export const writeScratchpadTool = {
  name: "write_scratchpad",
  description: `Write content to the session's scratchpad, replacing any existing content.

Use the scratchpad to store:
- Working notes and intermediate findings
- Reasoning trails and decision logs
- Blockers and current approach documentation
- Any contextual information needed across tool calls

The entire content is replaced - to append, first read the current content and concatenate.`,
  inputSchema: WriteScratchpadInputSchema,
  handler: writeScratchpad,
};
