export type DevelopmentRecommendation = Readonly<{
  external: Readonly<{ label: string; provider: string; url: string }> | null;
  gap: string;
  offerLab: Readonly<{ label: string; path: string }>;
  project: string;
  skill: string;
}>;

type GuidanceRule = Readonly<{
  external: DevelopmentRecommendation["external"];
  offerLab: DevelopmentRecommendation["offerLab"];
  patterns: readonly RegExp[];
  project: string;
  skill: string;
}>;

const rules: readonly GuidanceRule[] = [
  {
    external: {
      label: "SQL for Data Science",
      provider: "Coursera · UC Davis",
      url: "https://www.coursera.org/learn/sql-for-data-science",
    },
    offerLab: { label: "Build a SQL evidence project", path: "/member/learn/sql-evidence-project" },
    patterns: [
      /\bsql\b/iu,
      /\bpostgres(?:ql)?\b/iu,
      /query(?:ing| languages?)/iu,
      /relational database/iu,
    ],
    project:
      "Choose a public dataset, answer three business questions with joins and aggregations, then publish the queries, checks and a short decision-focused summary.",
    skill: "SQL and data querying",
  },
  {
    external: {
      label: "Prepare and visualise data with Power BI",
      provider: "Microsoft Learn",
      url: "https://learn.microsoft.com/en-us/training/paths/prepare-visualize-data-power-bi/",
    },
    offerLab: {
      label: "Build a dashboard evidence project",
      path: "/member/learn/dashboard-evidence-project",
    },
    patterns: [/power\s*bi/iu, /tableau/iu, /looker/iu, /dashboard/iu, /data visuali[sz]ation/iu],
    project:
      "Turn a messy dataset into a dashboard for a named audience. Document the cleaning choices, measures, chart decisions and one recommendation the dashboard supports.",
    skill: "Dashboards and data visualisation",
  },
  {
    external: {
      label: "Python for Data Science, AI & Development",
      provider: "Coursera · IBM",
      url: "https://www.coursera.org/learn/python-for-applied-data-science-ai",
    },
    offerLab: {
      label: "Build a Python analysis project",
      path: "/member/learn/python-data-evidence-project",
    },
    patterns: [/\bpython\b/iu, /\bpandas\b/iu, /\bnumpy\b/iu, /statistical analysis/iu],
    project:
      "Clean and analyse a public dataset in a reproducible notebook. Explain the data-quality checks, method, findings and limitations rather than showing code alone.",
    skill: "Python data analysis",
  },
  {
    external: null,
    offerLab: {
      label: "Build a spreadsheet analysis project",
      path: "/member/learn/spreadsheet-analysis-evidence-project",
    },
    patterns: [/\bexcel\b/iu, /spreadsheet/iu, /pivot tables?/iu, /\bvlookup\b/iu],
    project:
      "Create an auditable workbook that cleans raw data, calculates useful measures and presents a concise summary. Keep inputs, workings and outputs easy to inspect.",
    skill: "Excel and spreadsheet analysis",
  },
];

export function developmentRecommendations(
  missingRequirements: readonly string[],
): readonly DevelopmentRecommendation[] {
  const recommendations: DevelopmentRecommendation[] = [];
  const usedSkills = new Set<string>();
  for (const gap of missingRequirements) {
    const rule = rules.find((candidate) => candidate.patterns.some((pattern) => pattern.test(gap)));
    if (rule && !usedSkills.has(rule.skill)) {
      usedSkills.add(rule.skill);
      recommendations.push({
        external: rule.external,
        gap,
        offerLab: rule.offerLab,
        project: rule.project,
        skill: rule.skill,
      });
      continue;
    }
    recommendations.push({
      external: null,
      gap,
      offerLab: {
        label: "Plan a role-relevant evidence project",
        path: "/member/learn/role-evidence-project",
      },
      project: `Define a small deliverable that demonstrates “${gap}”, has a real or realistic audience and produces something you can explain, show and reflect on truthfully.`,
      skill: "Role-relevant evidence",
    });
  }
  return recommendations;
}
