import { z } from "zod";

export const careerDocumentKinds = ["cv", "cover_letter"] as const;
export type CareerDocumentKind = (typeof careerDocumentKinds)[number];

const optionalTrimmed = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().min(1).max(maximum).nullable(),
  );

export const careerDocumentTitleSchema = z
  .object({
    kind: z.enum(careerDocumentKinds),
    title: z.string().trim().min(1).max(160),
  })
  .strict();

export const careerDocumentVersionInputSchema = z
  .object({
    contentText: z.string().trim().min(40).max(60_000),
    jobDescription: z.string().trim().max(30_000).default(""),
    label: z.string().trim().min(1).max(160),
    targetCompany: optionalTrimmed(160),
    targetJobId: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().uuid().nullable(),
    ),
    targetRole: optionalTrimmed(160),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.jobDescription && (!value.targetCompany || !value.targetRole)) {
      context.addIssue({
        code: "custom",
        message: "Add the company and role when using a job description.",
        path: [!value.targetCompany ? "targetCompany" : "targetRole"],
      });
    }
  });

export type CareerDocumentVersionInput = z.infer<typeof careerDocumentVersionInputSchema>;

export const careerJobTargetInputSchema = z
  .object({
    applyUrl: z.url().nullable(),
    companyId: z.string().uuid().nullable().optional().default(null),
    companyName: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(30_000),
    employmentType: z.string().trim().min(1).max(80).nullable(),
    fetchedAt: z.coerce.date().nullable(),
    location: z.string().trim().min(1).max(200).nullable(),
    provider: z.enum(["manual", "jsearch"]),
    providerJobId: z.string().trim().min(1).max(500).nullable(),
    publishedAt: z.coerce.date().nullable(),
    roleTitle: z.string().trim().min(1).max(160),
    sourcePublisher: z.string().trim().min(1).max(160).nullable(),
    sourceUrl: z.url().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    for (const key of ["applyUrl", "sourceUrl"] as const) {
      const url = value[key];
      if (url && !/^https?:\/\//u.test(url)) {
        context.addIssue({ code: "custom", message: "Use an HTTP(S) URL.", path: [key] });
      }
    }
    if (
      (value.provider === "manual" && (value.providerJobId || value.fetchedAt)) ||
      (value.provider === "jsearch" && (!value.providerJobId || !value.fetchedAt))
    ) {
      context.addIssue({ code: "custom", message: "Invalid provider identity." });
    }
  });

export type CareerJobTargetInput = z.infer<typeof careerJobTargetInputSchema>;
