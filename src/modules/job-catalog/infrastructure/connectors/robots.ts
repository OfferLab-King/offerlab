import { logger } from "../logging";
import { createHttpClient, fetchText, type HttpClient } from "./http-client";
import { JobFetchError } from "./errors";

export type RobotsDecision = "allowed" | "blocked" | "unknown";

type RobotsRule = Readonly<{ path: string; allow: boolean }>;

const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60_000;

export function parseRobotsTxt(content: string, userAgentToken: string): readonly RobotsRule[] {
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  let current = { agents: [] as string[], rules: [] as RobotsRule[] };
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.split("#", 1)[0]!.trim();
    if (!line || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === "user-agent") {
      if (current.rules.length > 0) {
        groups.push(current);
        current = { agents: [], rules: [] };
      }
      current.agents.push(...value.split(/[\s,;]+/u).filter(Boolean));
      continue;
    }
    if (field === "allow" && value) {
      current.rules.push({ allow: true, path: value });
    } else if (field === "disallow" && value) {
      current.rules.push({ allow: false, path: value });
    }
  }
  if (current.agents.length > 0 || current.rules.length > 0) groups.push(current);

  const token = userAgentToken.toLowerCase();
  const scored = groups
    .map((group) => ({
      group,
      score: Math.max(
        -1,
        ...group.agents.map((agent) => {
          const normalized = agent.toLowerCase();
          if (normalized === "*") return 0;
          return token.startsWith(normalized) ? normalized.length : -1;
        }),
      ),
    }))
    .filter(({ score }) => score >= 0);
  if (scored.length === 0) return [];
  const bestScore = Math.max(...scored.map(({ score }) => score));
  return scored.flatMap(({ group, score }) => (score === bestScore ? group.rules : []));
}

function ruleMatches(pattern: string, path: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\*]/gu, "\\$&");
  const regex = new RegExp(`^${escaped.replace(/\\\*/gu, ".*").replace(/\\\$/gu, "$")}`, "iu");
  return regex.test(path);
}

export function evaluateRobotsRules(
  rules: readonly RobotsRule[],
  path: string,
): "allowed" | "blocked" {
  const applicable = rules.filter((rule) => ruleMatches(rule.path, path));
  if (applicable.length === 0) return "allowed";
  const mostSpecific = applicable.reduce((best, rule) => {
    if (rule.path.length > best.path.length) return rule;
    if (rule.path.length === best.path.length && rule.allow) return rule;
    return best;
  });
  return mostSpecific.allow ? "allowed" : "blocked";
}

export type RobotsGateOptions = Readonly<{
  cacheTtlMs?: number;
  httpClient: HttpClient;
  robotsFetchTimeoutMs?: number;
}>;

export class RobotsGate {
  private readonly cache = new Map<string, { checkedAt: number; rules: readonly RobotsRule[] }>();
  private readonly cacheTtlMs: number;
  private readonly httpClient: HttpClient;

  constructor(options: RobotsGateOptions) {
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.httpClient = options.httpClient;
  }

  async check(url: string, userAgentToken: string): Promise<RobotsDecision> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return "unknown";
    }
    const host = parsed.host;
    const cached = this.cache.get(host);
    if (cached && Date.now() - cached.checkedAt < this.cacheTtlMs) {
      return evaluateRobotsRules(cached.rules, parsed.pathname + parsed.search);
    }
    const robotsUrl = `${parsed.protocol}//${host}/robots.txt`;
    let rules: readonly RobotsRule[];
    try {
      const response = await fetchText(robotsUrl, {
        httpClient: createHttpClient({
          retries: 0,
          timeoutMs: 8_000,
          userAgent: this.httpClient.userAgent,
          ...(this.httpClient.resolveHost ? { resolveHost: this.httpClient.resolveHost } : {}),
        }),
      });
      rules = parseRobotsTxt(response.body, userAgentToken);
    } catch (error) {
      if (error instanceof JobFetchError && error.code === "http_404") {
        rules = [];
        logger.info({ event: "robots_txt_absent", host });
      } else {
        logger.warn({
          event: "robots_txt_unavailable",
          host,
          reason: error instanceof Error ? error.message : "unknown",
        });
        return "unknown";
      }
    }
    this.cache.set(host, { checkedAt: Date.now(), rules });
    return evaluateRobotsRules(rules, parsed.pathname + parsed.search);
  }
}
