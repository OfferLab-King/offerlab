import { jobSubsectors, type JobSectorKey, type JobSubsectorKey } from "./taxonomy";

export type ClassificationConfidence = "high" | "low";

export type ClassificationResult = Readonly<{
  sectorKey: JobSectorKey | null;
  subsectorKey: JobSubsectorKey | null;
  confidence: ClassificationConfidence;
  source: "deterministic";
  reasons: readonly string[];
}>;

export type ClassificationInput = Readonly<{
  title: string;
  department?: string | null;
  team?: string | null;
}>;

type KeywordRule = Readonly<{
  subsectorKey: JobSubsectorKey;
  patterns: readonly RegExp[];
  strong: boolean;
}>;

const keywordRules: readonly KeywordRule[] = [
  {
    subsectorKey: "software_development",
    patterns: [
      /\bsoftware\s+engineer/iu,
      /\bdeveloper\b/iu,
      /\b(?:frontend|front-end|backend|back-end|full[- ]stack|mobile|ios|android|web)\s+engineer\b/iu,
      /\bsoftware\s+development\b/iu,
      /\bsdet\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "data_science_analytics",
    patterns: [
      /\bdata\s+engineer\b/iu,
      /\bdata\s+scientist\b/iu,
      /\bmachine\s+learning\b/iu,
      /\bdata\s+analyst\b/iu,
      /\bbi[- ]analyst\b/iu,
      /\bquantitative\s+analyst\b/iu,
      /\bdata\s+science\b/iu,
      /\binsights\s+analyst\b/iu,
      /\bproduct\s+analyst\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "cyber_security",
    patterns: [
      /\bcyber\b/iu,
      /\bsecurity\s+engineer\b/iu,
      /\bpen(?:etration)?[- ]?tester\b/iu,
      /\binfosec\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "it_infrastructure",
    patterns: [
      /\bsite\s+reliability\b/iu,
      /\bdevops\b/iu,
      /\bplatform\s+engineer\b/iu,
      /\bcloud\s+engineer\b/iu,
      /\bnetwork\s+engineer\b/iu,
      /\btechnical\s+support\b/iu,
      /\bit\s+support\b/iu,
      /\bsystems\s+administrator\b/iu,
      /\binfrastructure\s+engineer\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "engineering",
    patterns: [
      /\bmechanical\s+engineer\b/iu,
      /\bcivil\s+engineer\b/iu,
      /\belectrical\s+engineer\b/iu,
      /\bstructural\s+engineer\b/iu,
      /\bchemical\s+engineer\b/iu,
      /\bprocess\s+engineer\b/iu,
      /\bmanufacturing\s+engineer\b/iu,
      /\bengineering\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "energy",
    patterns: [
      /\benergy\b/iu,
      /\brenewables?\b/iu,
      /\bsolar\b/iu,
      /\bwind\s+(?:farm|energy)\b/iu,
      /\bgrid\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "property_construction",
    patterns: [
      /\bconstruction\b/iu,
      /\bquantity\s+surveyor\b/iu,
      /\bproject\s+manager\b/iu,
      /\bproperty\b/iu,
      /\breal\s+estate\b/iu,
      /\bbuilding\s+surveyor\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "architecture",
    patterns: [/\barchitect\b/iu, /\barchitecture\b/iu, /\burban\s+design\b/iu],
    strong: true,
  },
  {
    subsectorKey: "accounting_audit_tax",
    patterns: [
      /\baudit\b/iu,
      /\bassurance\b/iu,
      /\baccount(?:ant|ing)\b/iu,
      /\btax\b/iu,
      /\bactuarial\b/iu,
      /\bactuary\b/iu,
      /\bcorporate\s+finance\s+analyst\b/iu,
      /\bfinance\s+graduate\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "investment_banking",
    patterns: [
      /\binvestment\s+banking\b/iu,
      /\bm&a\b/iu,
      /\bmergers?\s+and\s+acquisitions?\b/iu,
      /\bcapital\s+markets\b/iu,
      /\bdebt\s+capital\s+markets\b/iu,
      /\bequity\s+capital\s+markets\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "trading",
    patterns: [
      /\btrader\b/iu,
      /\bsales\s+and\s+trading\b/iu,
      /\bmarkets?\s+(?:graduate|analyst|intern)/iu,
      /\bquant\b/iu,
      /\bdesk\s+analyst\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "asset_investment_management",
    patterns: [
      /\basset\s+management\b/iu,
      /\binvestment\s+analyst\b/iu,
      /\bfund\s+management\b/iu,
      /\bportfolio\s+management\b/iu,
      /\bwealth\s+management\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "private_equity",
    patterns: [/\bprivate\s+equity\b/iu, /\binvestment\s+analyst\b/iu],
    strong: true,
  },
  {
    subsectorKey: "retail_corporate_banking",
    patterns: [
      /\bcorporate\s+banking\b/iu,
      /\bretail\s+banking\b/iu,
      /\bcommercial\s+banking\b/iu,
      /\bbank\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "insurance_pensions",
    patterns: [
      /\binsurance\b/iu,
      /\bpensions?\b/iu,
      /\bunderwriting\b/iu,
      /\bclaims?\s+(?:assistant|handler|adjuster)/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "management_consulting",
    patterns: [/\bmanagement\s+consultant\b/iu, /\bconsultant\b/iu, /\bconsulting\b/iu],
    strong: false,
  },
  {
    subsectorKey: "strategy_consulting",
    patterns: [/\bstrategy\s+consultant\b/iu, /\bstrategy\b/iu, /\bcorporate\s+strategy\b/iu],
    strong: true,
  },
  {
    subsectorKey: "financial_consulting",
    patterns: [/\bfinancial\s+consultant\b/iu, /\bfinancial\s+advisory\b/iu],
    strong: true,
  },
  {
    subsectorKey: "consulting_project_management",
    patterns: [
      /\bproject\s+manager\b/iu,
      /\bprogramme?\s+manager\b/iu,
      /\bdelivery\s+manager\b/iu,
      /\bscrum\b/iu,
      /\bagile\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "commercial_law",
    patterns: [
      /\bcommercial\s+law\b/iu,
      /\btraining\s+contract\b/iu,
      /\bsolicitor\b/iu,
      /\blegal\b/iu,
      /\bparalegal\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "criminal_law",
    patterns: [
      /\bcriminal\s+law\b/iu,
      /\bprosecution\b/iu,
      /\bdefence\s+(?:solicitor|barrister)\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "marketing",
    patterns: [
      /\bmarketing\b/iu,
      /\bseo\b/iu,
      /\bsocial\s+media\b/iu,
      /\bbrand\s+(?:manager|assistant|executive)\b/iu,
      /\bcontent\s+(?:manager|executive|creator)\b/iu,
      /\bdigital\s+marketing\b/iu,
      /\bgrowth\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "public_relations",
    patterns: [
      /\bpublic\s+relations\b/iu,
      /\bpr\s+(?:assistant|executive|intern)/iu,
      /\bcommunications\s+executive\b/iu,
      /\bcorporate\s+communications\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "media_film_tv",
    patterns: [
      /\bfilm\b/iu,
      /\btelevision\b/iu,
      /\bvideo\s+(?:editor|producer)\b/iu,
      /\bproduction\s+(?:assistant|coordinator)\b/iu,
      /\bbroadcast\b/iu,
      /\bmedia\b/iu,
    ],
    strong: false,
  },
  {
    subsectorKey: "journalism_publishing",
    patterns: [
      /\bjournalist\b/iu,
      /\bjournalism\b/iu,
      /\bnews?\s+(?:reporter|editor|writer)\b/iu,
      /\bpublishing\b/iu,
      /\beditorial\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "human_resources",
    patterns: [
      /\bhuman\s+resources\b/iu,
      /\bhr\s+(?:assistant|coordinator|generalist|advisor|graduate)/iu,
      /\btalent\s+(?:acquisition|partner|coordinator)\b/iu,
      /\bpeople\s+(?:operations|partner|advisor)\b/iu,
      /\brecruitment\s+(?:consultant|coordinator|resourcer)/iu,
      /\bl\s+d\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "recruitment",
    patterns: [
      /\brecruitment\s+(?:consultant|executive|specialist)\b/iu,
      /\bexecutive\s+search\b/iu,
      /\bheadhunt(?:er|ing)\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "sales_commercial",
    patterns: [
      /\bsales\s+(?:associate|executive|representative|consultant|graduate|intern)/iu,
      /\baccount\s+executive\b/iu,
      /\baccount\s+manager\b/iu,
      /\bbusiness\s+development\b/iu,
      /\bcommercial\s+graduate\b/iu,
      /\bkey\s+account\b/iu,
      /\bsolutions?\s+(?:engineer|consultant)\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "consumer_goods_fmcg",
    patterns: [
      /\bfmcg\b/iu,
      /\bconsumer\s+goods\b/iu,
      /\bbrand\s+manager\b/iu,
      /\bcategory\s+(?:manager|assistant)\b/iu,
      /\bcommercial\s+(?:analyst|graduate)\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "retail_fashion",
    patterns: [
      /\bretail\b/iu,
      /\bfashion\b/iu,
      /\bstore\s+(?:manager|assistant)\b/iu,
      /\bmerchandis(?:er|ing)\b/iu,
      /\bbuyer\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "supply_chain_logistics",
    patterns: [
      /\bsupply\s+chain\b/iu,
      /\blogistics\b/iu,
      /\bwarehouse\b/iu,
      /\bprocurement\b/iu,
      /\boperations\s+graduate\b/iu,
      /\bplanning\s+analyst\b/iu,
      /\bimport\s+(?:coordinator|executive)\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "business_management",
    patterns: [
      /\bbusiness\s+(?:analyst|graduate|management)/iu,
      /\bmanagement\s+graduate\b/iu,
      /\bgeneral\s+management\b/iu,
    ],
    strong: false,
  },
  {
    subsectorKey: "operations_communications",
    patterns: [
      /\boperations\s+(?:assistant|coordinator|manager)\b/iu,
      /\boffice\s+manager\b/iu,
      /\badmin(?:istrator|istration)?\b/iu,
      /\bexecutive\s+assistant\b/iu,
    ],
    strong: false,
  },
  {
    subsectorKey: "entrepreneurship",
    patterns: [
      /\bstartup\b/iu,
      /\bentrepreneur\b/iu,
      /\baccelerator\b/iu,
      /\bfounder\s+(?:associate|programme)/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "pharmaceuticals",
    patterns: [
      /\bpharma(?:ceutical)?\b/iu,
      /\bclinical\s+(?:trial|research|associate)\b/iu,
      /\bregulatory\s+affairs\b/iu,
      /\bdrug\s+discovery\b/iu,
      /\bmedical\s+affairs\b/iu,
      /\bquality\s+(?:assurance|control)\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "science_research",
    patterns: [
      /\bresearch\s+(?:scientist|assistant|associate|analyst)\b/iu,
      /\blaboratory\b/iu,
      /\blab\s+(?:technician|assistant)\b/iu,
      /\bscientist\b/iu,
      /\btechnician\b/iu,
      /\bchemistry\b/iu,
      /\bbiology\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "education_teaching",
    patterns: [
      /\bteacher\b/iu,
      /\bteaching\b/iu,
      /\blecturer\b/iu,
      /\blectureship\b/iu,
      /\bschool\s+leadership\b/iu,
      /\bearly\s+years\s+(?:educator|practitioner)\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "public_sector_government",
    patterns: [
      /\bcivil\s+service\b/iu,
      /\bgovernment\b/iu,
      /\bpolicy\s+(?:advisor|officer|analyst)\b/iu,
      /\bpublic\s+service\b/iu,
      /\bministry\b/iu,
      /\bcouncil\b/iu,
      /\bdiplomacy\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "charity_social_enterprise",
    patterns: [
      /\bcharity\b/iu,
      /\bnon[- ]profit\b/iu,
      /\bsocial\s+enterprise\b/iu,
      /\bngo\b/iu,
      /\bvolunteer(?:ing)?\s+(?:coordinator|manager)\b/iu,
      /\bfundraising\b/iu,
    ],
    strong: true,
  },
  {
    subsectorKey: "other",
    patterns: [],
    strong: false,
  },
];

const departmentTeamRules: readonly {
  patterns: readonly RegExp[];
  subsectorKey: JobSubsectorKey;
}[] = [
  { patterns: [/software/i], subsectorKey: "software_development" },
  {
    patterns: [/data/i, /analytics/i, /insights/i, /machine learning/i],
    subsectorKey: "data_science_analytics",
  },
  { patterns: [/security/i, /cyber/i], subsectorKey: "cyber_security" },
  {
    patterns: [/infrastructure/i, /platform/i, /devops/i, /cloud/i, /it\b/i],
    subsectorKey: "it_infrastructure",
  },
  {
    patterns: [/audit/i, /assurance/i, /accounting/i, /tax/i],
    subsectorKey: "accounting_audit_tax",
  },
  {
    patterns: [/investment banking/i, /investment bank/i, /m&a/i, /capital markets/i],
    subsectorKey: "investment_banking",
  },
  { patterns: [/trading/i, /markets/i, /sales and trading/i], subsectorKey: "trading" },
  {
    patterns: [/asset management/i, /investment management/i],
    subsectorKey: "asset_investment_management",
  },
  { patterns: [/private equity/i], subsectorKey: "private_equity" },
  { patterns: [/consulting/i, /strategy/i], subsectorKey: "management_consulting" },
  { patterns: [/marketing/i, /brand/i], subsectorKey: "marketing" },
  { patterns: [/communications/i, /pr\b/i, /public relations/i], subsectorKey: "public_relations" },
  {
    patterns: [/human resources/i, /people/i, /talent/i, /recruiting/i, /recruitment/i],
    subsectorKey: "human_resources",
  },
  { patterns: [/sales/i, /commercial/i], subsectorKey: "sales_commercial" },
  { patterns: [/legal/i, /law/i], subsectorKey: "commercial_law" },
  {
    patterns: [/operations/i, /supply chain/i, /logistics/i, /procurement/i],
    subsectorKey: "supply_chain_logistics",
  },
  { patterns: [/research/i, /science/i, /r&d/i, /laboratory/i], subsectorKey: "science_research" },
  { patterns: [/engineering/i], subsectorKey: "engineering" },
  { patterns: [/energy/i, /renewable/i, /grid/i], subsectorKey: "energy" },
];

export function classifyJob(input: ClassificationInput): ClassificationResult {
  const title = input.title.trim();
  const context = [input.department, input.team].filter(Boolean).join(" ").trim();

  const departmentMatch = matchDepartmentTeam(context);
  if (departmentMatch) {
    return classificationFor(departmentMatch, `department/team: ${departmentMatch}`, true);
  }

  const matches = keywordRules.flatMap((rule) => {
    if (rule.patterns.length === 0) return [];
    const matched = rule.patterns.find((pattern) => pattern.test(title));
    return matched ? [{ rule, pattern: matched }] : [];
  });

  if (matches.length === 0) {
    return {
      sectorKey: null,
      subsectorKey: null,
      confidence: "low",
      source: "deterministic",
      reasons: ["no_classification_match"],
    };
  }

  const strongest = matches
    .slice()
    .sort((a, b) => (a.rule.strong === b.rule.strong ? 0 : a.rule.strong ? -1 : 1));
  const best = strongest[0]!;
  const sameStrengthOthers = strongest.filter((match) => match.rule.strong === best.rule.strong);

  if (best.rule.strong === false && sameStrengthOthers.length > 1) {
    return {
      sectorKey: null,
      subsectorKey: null,
      confidence: "low",
      source: "deterministic",
      reasons: ["ambiguous_title_match"],
    };
  }

  const matchText = title.match(best.pattern)?.[0] ?? "";
  return classificationFor(
    best.rule.subsectorKey,
    `title: ${matchText.trim()}`.slice(0, 120),
    best.rule.strong,
  );
}

function matchDepartmentTeam(context: string): JobSubsectorKey | null {
  if (!context) return null;
  const matches = departmentTeamRules.filter((rule) =>
    rule.patterns.some((pattern) => pattern.test(context)),
  );
  if (matches.length !== 1) return null;
  return matches[0]!.subsectorKey;
}

function classificationFor(
  subsectorKey: JobSubsectorKey,
  reason: string,
  strong: boolean,
): ClassificationResult {
  const sector =
    jobSubsectors.find((subsector) => subsector.key === subsectorKey)?.sectorKey ?? null;
  return {
    sectorKey: sector,
    subsectorKey,
    confidence: strong ? "high" : "low",
    source: "deterministic",
    reasons: [reason],
  };
}

export function classificationRequiresReview(result: ClassificationResult): boolean {
  return result.confidence === "low" || result.subsectorKey === null;
}
