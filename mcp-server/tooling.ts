import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { stripNulls } from "./serialize.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  _payload?: unknown;
};

export type ToolRegistration = {
  name: string;
  annotations: ToolAnnotations;
};

export const TOOL_REGISTRY: ToolRegistration[] = [];

/**
 * `_payload` is `unknown`, and `stripNulls` only makes sense over an object.
 * Arrays and primitives pass through untouched rather than being coerced.
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ResponseFormatSchema = z
  .enum(["concise", "full"])
  .optional()
  .describe(
    'Response detail. Default "concise" omits timestamps/nulls/empty arrays; "full" returns complete records.',
  );

export function ok(payload: unknown): ToolResult {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    _payload: payload,
  };
}

export function err(message: string): ToolResult {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

export function defineTool<S extends z.ZodRawShape>(
  server: McpServer,
  opts: {
    name: string;
    description: string;
    schema: S;
    annotations?: Partial<ToolAnnotations>;
    concise?: (payload: unknown) => unknown;
    handler: (
      params: z.objectOutputType<
        S & { response_format: typeof ResponseFormatSchema },
        z.ZodTypeAny
      >,
    ) => Promise<ToolResult>;
  },
): void {
  const annotations: ToolAnnotations = {
    openWorldHint: false,
    ...opts.annotations,
  };

  TOOL_REGISTRY.push({ name: opts.name, annotations });

  const fullSchema = {
    ...opts.schema,
    response_format: ResponseFormatSchema,
  };

  server.registerTool(
    opts.name,
    {
      description: opts.description,
      inputSchema: fullSchema,
      annotations,
    },
    // The SDK types this callback against the inferred zod shape. We erase it
    // to one signature so every tool shares a single wrapper; the handler is
    // still checked against `opts.schema` at the defineTool call site.
    (async (params: Record<string, unknown>) => {
      const result = await opts.handler(params as never);

      if (result.isError) return result;

      const format =
        (params.response_format as string | undefined) ?? "concise";
      if (format === "concise" && result._payload !== undefined) {
        const projected = opts.concise
          ? opts.concise(result._payload)
          : isPlainRecord(result._payload)
            ? stripNulls(result._payload)
            : result._payload;
        return {
          content: [{ type: "text" as const, text: JSON.stringify(projected) }],
        };
      }

      return { content: result.content };
    }) as Parameters<typeof server.registerTool>[2],
  );
}
