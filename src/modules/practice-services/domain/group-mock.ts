import { z } from "zod";

export const groupMockRulesVersion = "2026-07-27";

export const groupMockSectors = {
  asset_management: "Asset management",
  challenger_banking: "Challenger banking",
  energy_utilities: "Energy & utilities",
  healthcare: "Healthcare",
  higher_education: "Higher education",
  hospitality: "Hospitality",
  insurance: "Insurance",
  professional_services: "Professional services",
  retail_consumer: "Retail & consumer",
  technology: "Technology",
} as const;

export const groupMockExerciseTypes = {
  case_discussion: "Case discussion",
  client_pitch: "Client pitch",
  crisis_response: "Crisis response",
  data_interpretation: "Data interpretation",
  investment_committee: "Investment committee",
  negotiation: "Negotiation",
  prioritisation: "Prioritisation exercise",
  role_play: "Role-based discussion",
  strategy_workshop: "Strategy workshop",
  written_brief: "Written brief discussion",
} as const;

export const groupMockProblemTypes = {
  capital_allocation: "Capital allocation",
  client_pitch: "Client pitch",
  cost_reduction: "Cost reduction",
  crisis_response: "Crisis response",
  customer_retention: "Customer retention",
  digital_transformation: "Digital transformation",
  esg_transition: "ESG transition",
  market_entry: "Market entry",
  revenue_growth: "Revenue growth",
  workforce_strategy: "Workforce strategy",
} as const;

export const groupMockDifficulties = {
  advanced: "Advanced",
  introductory: "Introductory",
  standard: "Standard",
} as const;

const safeHttpsUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Use an HTTPS URL without embedded credentials.");

const trimmed = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);

export const groupMockMaterialSchema = z
  .object({
    debriefQuestions: z.array(trimmed(2, 300)).min(2).max(10),
    deliverable: trimmed(10, 3000),
    difficulty: z.enum(Object.keys(groupMockDifficulties) as [keyof typeof groupMockDifficulties]),
    exerciseType: z.enum(
      Object.keys(groupMockExerciseTypes) as [keyof typeof groupMockExerciseTypes],
    ),
    informationPack: trimmed(20, 30000),
    observerRubric: trimmed(20, 10000),
    originalityConfirmed: z.literal(true),
    participantInstructions: trimmed(20, 5000),
    preparationMinutes: z.coerce.number().int().min(0).max(90),
    problemType: z.enum(Object.keys(groupMockProblemTypes) as [keyof typeof groupMockProblemTypes]),
    publicationState: z.enum(["draft", "published", "archived"]),
    recommendedGroupSize: z.coerce.number().int().min(3).max(8),
    recommendedMinutes: z.coerce.number().int().min(30).max(120),
    scenario: trimmed(20, 10000),
    sector: z.enum(Object.keys(groupMockSectors) as [keyof typeof groupMockSectors]),
    skills: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[a-z][a-z0-9_]{1,39}$/),
      )
      .min(2)
      .max(8),
    stableKey: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
    summary: trimmed(1, 500),
    title: trimmed(1, 160),
    discussionMinutes: z.coerce.number().int().min(15).max(120),
    followUpMinutes: z.coerce.number().int().min(0).max(60),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.recommendedMinutes !==
      value.preparationMinutes + value.discussionMinutes + value.followUpMinutes
    )
      context.addIssue({ code: "custom", message: "Activity timings must equal the total." });
  });

export const groupMockSessionSchema = z
  .object({
    accessMode: z.enum(["member_included", "manual_payment"]),
    capacity: z.coerce.number().int().min(3).max(8),
    endsAt: z.date(),
    materialId: z.string().uuid(),
    meetingInstructions: z.string().trim().max(500).nullable(),
    meetingProvider: z.enum(["zoom", "external"]).nullable(),
    meetingUrl: safeHttpsUrl.nullable(),
    minimumParticipants: z.coerce.number().int().min(3).max(8),
    paymentUrl: safeHttpsUrl.nullable(),
    pricePence: z.coerce.number().int().min(100).max(100000).nullable(),
    startsAt: z.date(),
    state: z.enum(["draft", "open", "closed", "completed", "cancelled"]),
    title: trimmed(1, 160),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.endsAt <= value.startsAt ||
      value.endsAt.getTime() > value.startsAt.getTime() + 10_800_000
    )
      context.addIssue({
        code: "custom",
        message: "Session must last between one minute and three hours.",
      });
    if (value.minimumParticipants > value.capacity)
      context.addIssue({ code: "custom", message: "Minimum participants cannot exceed capacity." });
    if (value.accessMode === "member_included" && (value.pricePence || value.paymentUrl))
      context.addIssue({
        code: "custom",
        message: "Included sessions cannot have payment details.",
      });
    if (value.accessMode === "manual_payment" && (!value.pricePence || !value.paymentUrl))
      context.addIssue({
        code: "custom",
        message: "Paid sessions require a price and payment URL.",
      });
    if (
      (value.meetingProvider && !value.meetingUrl) ||
      (!value.meetingProvider && value.meetingUrl)
    )
      context.addIssue({
        code: "custom",
        message: "Meeting provider and URL must be supplied together.",
      });
  });

export const groupMockBookingSchema = z
  .object({
    ageConfirmed: z.literal(true),
    rulesConfirmed: z.literal(true),
    sessionId: z.string().uuid(),
  })
  .strict();

export const groupMockBookingAdministrationSchema = z
  .object({
    bookingId: z.string().uuid(),
    status: z.enum(["confirmed", "cancelled", "attended", "no_show"]),
    version: z.coerce.number().int().positive(),
  })
  .strict();

export function parseLondonDateTime(input: unknown): Date | null {
  if (typeof input !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(input);
  if (!match) return null;
  const wanted = match.slice(1).map(Number);
  const initial = Date.UTC(wanted[0]!, wanted[1]! - 1, wanted[2]!, wanted[3]!, wanted[4]!);
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Europe/London",
    year: "numeric",
  }).formatToParts(new Date(initial));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const represented = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
  );
  const result = new Date(initial - (represented - initial));
  const verification = new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Europe/London",
    year: "numeric",
  })
    .format(result)
    .replace(" ", "T");
  return verification === input ? result : null;
}

export function formatLondonDateTimeInput(value: string | Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Europe/London",
    year: "numeric",
  })
    .format(new Date(value))
    .replace(" ", "T");
}
