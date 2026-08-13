import { z } from "zod";
import { logger } from "./logging";
import {
  buildEnrichmentSystemPrompt,
  buildEnrichmentUserPrompt,
  JOB_ENRICHMENT_PROMPT_VERSION,
  jobEnrichmentOutputSchema,
  validateEnrichmentOutput,
  type JobEnrichmentInput,
  type JobEnrichmentOutput,
} from "../domain/enrichment-schema";
import { isSafeWebUrl } from "../domain/urls";
import { JobFetchError } from "./connectors/errors";

export type EnrichmentConfiguration = Readonly<{
  apiKey: string;
  baseUrl: string;
  model: string;
  providerName?: "deepseek" | "opencode_go";
  timeoutMs?: number;
}>;

export type EnrichmentResult = Readonly<{
  inputTokens: number;
  latencyMs: number;
  output: JobEnrichmentOutput;
  outputTokens: number;
  version: number;
}>;

const apiResponseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            finish_reason: z.string().nullable(),
            message: z.object({ content: z.string().nullable() }).passthrough(),
          })
          .passthrough(),
      )
      .min(1),
    usage: z
      .object({
        completion_tokens: z.number().int().nonnegative(),
        prompt_tokens: z.number().int().nonnegative(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

type FetchLike = typeof fetch;

export function createEnrichmentProvider(
  configuration: EnrichmentConfiguration,
  fetchImplementation: FetchLike = fetch,
): {
  enrich(input: JobEnrichmentInput): Promise<EnrichmentResult>;
} {
  if (
    !isSafeWebUrl(configuration.baseUrl) ||
    (process.env.NODE_ENV === "production" && new URL(configuration.baseUrl).protocol !== "https:")
  ) {
    throw new Error("job_enrichment_provider_url_invalid");
  }
  const endpoint = `${configuration.baseUrl.replace(/\/+$/u, "")}/chat/completions`;
  const systemPrompt = buildEnrichmentSystemPrompt();
  return {
    async enrich(input: JobEnrichmentInput) {
      let inputTokens = 0;
      let outputTokens = 0;
      const startedAt = Date.now();
      let repairInstruction =
        "Return one complete JSON object matching the exact schema with no extra keys.";
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), configuration.timeoutMs ?? 30_000);
        try {
          const response = await fetchImplementation(endpoint, {
            body: JSON.stringify({
              max_tokens: 1800,
              messages: [
                {
                  content:
                    attempt === 0
                      ? systemPrompt
                      : `${systemPrompt}\nYour prior response was rejected. ${repairInstruction}`,
                  role: "system",
                },
                { content: buildEnrichmentUserPrompt(input), role: "user" },
              ],
              model: configuration.model,
              response_format: { type: "json_object" },
              temperature: 0.1,
              thinking: { type: "disabled" },
            }),
            headers: {
              authorization: `Bearer ${configuration.apiKey}`,
              "content-type": "application/json",
            },
            method: "POST",
            signal: controller.signal,
          });
          if (!response.ok) {
            logger.warn({
              event: "job_enrichment_provider_failed",
              provider: configuration.providerName ?? "deepseek",
              statusCode: response.status,
            });
            throw new JobFetchError("source_unavailable", "enrichment_provider_unavailable", {
              retryable: response.status >= 500 || response.status === 429,
            });
          }
          let apiResponse: z.infer<typeof apiResponseSchema>;
          try {
            apiResponse = apiResponseSchema.parse(await response.json());
          } catch {
            throw new Error("job_enrichment_model_response_invalid");
          }
          inputTokens += apiResponse.usage?.prompt_tokens ?? 0;
          outputTokens += apiResponse.usage?.completion_tokens ?? 0;
          const choice = apiResponse.choices[0]!;
          if (choice.finish_reason === "length" || !choice.message.content) {
            throw new Error("job_enrichment_model_response_incomplete");
          }
          let parsed: JobEnrichmentOutput;
          try {
            parsed = jobEnrichmentOutputSchema.parse(JSON.parse(choice.message.content));
          } catch {
            repairInstruction =
              "Return one complete JSON object matching the exact schema with no extra keys.";
            logger.warn({
              attempt: attempt + 1,
              event: "job_enrichment_model_output_rejected",
              reason: "schema_validation_failed",
            });
            throw new Error("job_enrichment_model_output_invalid");
          }
          try {
            validateEnrichmentOutput(parsed, input.descriptionText);
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "job_enrichment_visa_evidence_without_status"
            ) {
              repairInstruction =
                "When visaSponsorshipStatus is unknown, visaSponsorshipEvidence must be null.";
            } else if (
              error instanceof Error &&
              error.message === "job_enrichment_visa_status_without_evidence"
            ) {
              repairInstruction =
                "A non-unknown visaSponsorshipStatus must be supported by visaSponsorshipEvidence quoting the posting.";
            } else if (
              error instanceof Error &&
              error.message === "job_enrichment_visa_evidence_not_grounded"
            ) {
              repairInstruction =
                "visaSponsorshipEvidence must be an exact contiguous quote from the posting description. Otherwise return unknown and null evidence.";
            }
            logger.warn({
              attempt: attempt + 1,
              event: "job_enrichment_model_output_rejected",
              reason: error instanceof Error ? error.message : "invalid",
            });
            throw new Error("job_enrichment_model_output_invalid");
          }
          const latencyMs = Date.now() - startedAt;
          logger.info({
            event: "job_enrichment_provider_completed",
            inputTokens,
            latencyMs,
            model: configuration.model,
            outputTokens,
            provider: configuration.providerName ?? "deepseek",
            version: JOB_ENRICHMENT_PROMPT_VERSION,
          });
          return {
            inputTokens,
            latencyMs,
            output: parsed,
            outputTokens,
            version: JOB_ENRICHMENT_PROMPT_VERSION,
          };
        } catch (error) {
          const isValidationError =
            error instanceof Error && error.message === "job_enrichment_model_output_invalid";
          if (isValidationError && attempt === 1) {
            throw new Error("job_enrichment_model_output_invalid");
          }
          if (!isValidationError) {
            if (error instanceof JobFetchError) throw error;
            throw new Error("job_enrichment_provider_unavailable");
          }
        } finally {
          clearTimeout(timeout);
        }
      }
      throw new Error("job_enrichment_provider_unavailable");
    },
  };
}
