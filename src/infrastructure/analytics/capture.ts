import "server-only";

import {
  assertAllowedAnalyticsProperties,
  NoOpAnalytics,
  type AnalyticsEventName,
} from "./analytics";

const analytics = new NoOpAnalytics();

export async function captureAnalyticsEvent(name: AnalyticsEventName): Promise<void> {
  const event = { name, occurredAt: new Date(), properties: {} } as const;
  assertAllowedAnalyticsProperties(event);
  await analytics.capture(event);
}
