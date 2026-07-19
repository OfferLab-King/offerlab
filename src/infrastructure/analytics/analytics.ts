export const analyticsEventDefinitions = {
  health_check_observed: {
    allowedProperties: ["source"] as const,
  },
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
