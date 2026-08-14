import "server-only";

import { captureAnalyticsEvent } from "../../../infrastructure/analytics/capture";
import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import {
  parseOnboardingInput,
  completionErrors,
  type OnboardingFieldErrors,
} from "../domain/onboarding";
import {
  findOnboardingProfile,
  saveOnboardingProfile,
  type OnboardingProfile,
} from "../infrastructure/onboarding-repository";

export async function readOnboardingProfile(ownerId: string): Promise<OnboardingProfile | null> {
  return withApplicationUser(ownerId, (database) => findOnboardingProfile(database, ownerId));
}

export async function updateOnboardingProfile(
  ownerId: string,
  input: unknown,
): Promise<
  | Readonly<{ errors: OnboardingFieldErrors; ok: false }>
  | Readonly<{ ok: true; outcome: string; profile: OnboardingProfile }>
> {
  const parsed = parseOnboardingInput(input);
  if (!parsed.ok) return parsed;

  const result = await withApplicationUser(ownerId, async (database) => {
    const saved = await saveOnboardingProfile(
      database,
      ownerId,
      parsed.value.answers,
      parsed.value.intent === "complete",
    );
    if (!saved.ok) {
      return { errors: completionErrors(parsed.value.answers), ok: false } as const;
    }
    return saved;
  });
  if (!result.ok) return result;
  if (result.analyticsEvent) await captureAnalyticsEvent(result.analyticsEvent);
  return result;
}
