import { z } from "zod";

export const VALID_COLORS = ["red", "blue", "green", "yellow"] as const;

export const playCardSchema = z.object({
  cardId: z.string().min(1).max(64),
  chosenColor: z.enum(VALID_COLORS).optional(),
}).strict();

export const chatSchema = z.object({
  text: z.string().min(1).max(200),
}).strict();

export const restartSchema = z.object({});

export const drawCardSchema = z.object({});

export const challengeWildDraw4Schema = z.object({});

export const unoSchema = z.object({});

export const voteRematchSchema = z.object({});

export const pingSchema = z.object({});

export type PlayCardPayload = z.infer<typeof playCardSchema>;
export type ChatPayload = z.infer<typeof chatSchema>;

export function validateMessage<T>(schema: z.ZodSchema<T>, data: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const issues = result.error.issues.map(i => i.message).join("; ");
  return { ok: false, error: issues };
}
