import { z } from "zod";

export const serviceStatuses = ["requested", "confirmed", "completed", "cancelled"] as const;
export const requestActionSchema = z.object({ offeringId: z.string().uuid() }).strict();
export const administrationActionSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["confirmed", "completed", "cancelled"]),
    version: z.number().int().positive(),
  })
  .strict();
export const offeringAdministrationSchema = z
  .object({
    availability: z.enum(["interest", "open", "paused"]),
    id: z.string().uuid(),
    version: z.number().int().positive(),
  })
  .strict();
