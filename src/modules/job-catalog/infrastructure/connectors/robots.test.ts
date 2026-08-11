import { describe, expect, it } from "vitest";

import { evaluateRobotsRules, parseRobotsTxt } from "./robots";

const sampleRobots = `User-agent: *
Disallow: /internal/
Disallow: /jobs/*/secret$
Allow: /jobs/

User-agent: BadBot
Disallow: /
`;

describe("robots.txt parsing", () => {
  it("selects the group matching our user agent token", () => {
    const rules = parseRobotsTxt(sampleRobots, "offerlab-jobs-bot");
    expect(rules.some((rule) => rule.path === "/internal/" && !rule.allow)).toBe(true);
  });

  it("evaluates path rules with wildcard and end anchors", () => {
    const rules = parseRobotsTxt(sampleRobots, "offerlab-jobs-bot");
    expect(evaluateRobotsRules(rules, "/internal/")).toBe("blocked");
    expect(evaluateRobotsRules(rules, "/jobs/123")).toBe("allowed");
    expect(evaluateRobotsRules(rules, "/jobs/123/secret")).toBe("blocked");
    expect(evaluateRobotsRules(rules, "/careers")).toBe("allowed");
  });

  it("uses the most specific matching rule for a path", () => {
    const rules = parseRobotsTxt(`User-agent: *\nDisallow: /jobs/\nAllow: /jobs/graduate/\n`, "x");
    expect(evaluateRobotsRules(rules, "/jobs/graduate/engineer")).toBe("allowed");
    expect(evaluateRobotsRules(rules, "/jobs/intern/engineer")).toBe("blocked");
  });

  it("prefers allow when equally specific rules conflict", () => {
    const rules = parseRobotsTxt(`User-agent: *\nDisallow: /jobs\nAllow: /jobs\n`, "x");
    expect(evaluateRobotsRules(rules, "/jobs")).toBe("allowed");
  });

  it("combines consecutive user-agent lines into one group", () => {
    const rules = parseRobotsTxt(
      `User-agent: offerlab-jobs-bot\nUser-agent: another-bot\nDisallow: /private\n`,
      "offerlab-jobs-bot",
    );
    expect(evaluateRobotsRules(rules, "/private")).toBe("blocked");
  });

  it("returns allowed when no group matches our agent", () => {
    const rules = parseRobotsTxt(`User-agent: OtherBot\nDisallow: /\n`, "offerlab-jobs-bot");
    expect(evaluateRobotsRules(rules, "/")).toBe("allowed");
  });

  it("ignores comments and malformed lines", () => {
    const rules = parseRobotsTxt(
      `# comment\nUser-agent: *\n:bad\nDisallow: /blocked # inline\n`,
      "x",
    );
    expect(rules.some((rule) => rule.path === "/blocked")).toBe(true);
  });
});
