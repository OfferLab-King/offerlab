export const analyticsEventDefinitions = {
  application_archived: { allowedProperties: [] as const },
  application_created: { allowedProperties: [] as const },
  application_restored: { allowedProperties: [] as const },
  application_stage_changed: { allowedProperties: [] as const },
  application_updated: { allowedProperties: [] as const },
  beta_access_denied: { allowedProperties: [] as const },
  email_verified: { allowedProperties: [] as const },
  health_check_observed: {
    allowedProperties: ["source"] as const,
  },
  invitation_accepted: { allowedProperties: [] as const },
  identity_linked: { allowedProperties: [] as const },
  onboarding_completed: { allowedProperties: [] as const },
  onboarding_saved: { allowedProperties: [] as const },
  onboarding_started: { allowedProperties: [] as const },
  onboarding_updated: { allowedProperties: [] as const },
  password_recovery_completed: { allowedProperties: [] as const },
  recommendation_completed: { allowedProperties: [] as const },
  recommendation_dismissed: { allowedProperties: [] as const },
  recommendation_restored: { allowedProperties: [] as const },
  resource_completed: { allowedProperties: [] as const },
  resource_marked_incomplete: { allowedProperties: [] as const },
  resource_opened: { allowedProperties: [] as const },
  resource_saved: { allowedProperties: [] as const },
  resource_unsaved: { allowedProperties: [] as const },
  registration_completed: { allowedProperties: [] as const },
  sign_out_completed: { allowedProperties: [] as const },
} as const;

export type AnalyticsEventName = keyof typeof analyticsEventDefinitions;

export type AnalyticsEvent = Readonly<{
  name: AnalyticsEventName;
  occurredAt: Date;
  properties: Readonly<Record<string, boolean | number | string>>;
  anonymousId?: string;
}>;

export interface Analytics {
  capture(event: AnalyticsEvent): Promise<void>;
}

export class NoOpAnalytics implements Analytics {
  public capture(event: AnalyticsEvent): Promise<void> {
    void event;
    return Promise.resolve();
  }
}

export function assertAllowedAnalyticsProperties(event: AnalyticsEvent): void {
  const allowedProperties = new Set<string>(
    analyticsEventDefinitions[event.name].allowedProperties,
  );
  const rejectedProperties = Object.keys(event.properties).filter(
    (property) => !allowedProperties.has(property),
  );

  if (rejectedProperties.length > 0) {
    throw new Error(
      `Analytics event ${event.name} contains disallowed properties: ${rejectedProperties.join(", ")}`,
    );
  }
}
