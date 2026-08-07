begin;

update app.group_mock_material set
  title='Lumen Bank: profitable growth under pressure',
  summary='Advise a fictional UK challenger bank on how to invest £18 million across customer growth, service resilience and financial sustainability.',
  sector='challenger_banking',
  problem_type='revenue_growth',
  exercise_type='investment_committee',
  difficulty='advanced',
  recommended_group_size=5,
  preparation_minutes=20,
  discussion_minutes=45,
  follow_up_minutes=15,
  recommended_minutes=80,
  skills=array['collaboration','commercial_awareness','data_interpretation','risk_judgement','customer_focus','prioritisation'],
  scenario=$case$
## Confidential candidate brief

You are part of a project team advising **Lumen Bank**, a fictional UK digital challenger bank. Lumen serves personal and small-business customers through its mobile app and has no branch network.

Lumen grew quickly by offering simple accounts, competitive savings rates and instant spending notifications. Customer numbers are still increasing, but profitability has moved in the wrong direction. Service complaints, fraud losses and pressure on the technology platform are also rising.

The board has approved an **£18 million change budget for the next 12 months**. Four investment proposals are competing for that budget. Funding all four is not possible.

Your group must recommend a portfolio that improves Lumen's path to profitable growth without weakening customer trust or operational resilience.

This is an original fictional exercise. All organisations, people and figures are synthetic. No outside banking knowledge is required.
$case$,
  participant_instructions=$case$
## Your role

You are an internal strategy team reporting to Lumen's executive committee. Work from the evidence in the case pack and make reasonable calculations where useful.

### Timing

1. **Individual preparation — 20 minutes:** read the case, identify the central problem and note your initial recommendation.
2. **Group discussion — 45 minutes:** agree decision criteria, test the proposals and build one portfolio recommendation.
3. **Executive read-out — 10 minutes:** present your recommendation and respond to challenge questions.
4. **Written follow-up — 5 minutes:** each participant records the most important risk or assumption the group should investigate next.

### Working expectations

- Agree the decision criteria before selecting a preferred proposal.
- Use the supplied figures; do not invent market data.
- Distinguish a fact, an assumption and a judgement.
- Consider customers, regulators, employees and shareholders.
- Invite challenge and make space for all group members.
- You may recommend one, two or three proposals, provided total first-year funding does not exceed £18 million.
$case$,
  information_pack=$case$
## Exhibit 1 — Three-year business snapshot

| Metric | FY2024 | FY2025 | FY2026 forecast |
|---|---:|---:|---:|
| Active customers | 620,000 | 810,000 | 980,000 |
| Revenue | £96m | £132m | £151m |
| Operating costs | £118m | £147m | £169m |
| Operating result | **−£22m** | **−£15m** | **−£18m** |
| Customer deposits | £1.8bn | £2.5bn | £3.1bn |
| Complaints per 1,000 customers | 3.1 | 4.2 | 6.0 |
| Fraud losses | £6m | £9m | £15m |
| App availability | 99.92% | 99.87% | 99.74% |

The finance director estimates that Lumen must improve annual operating contribution by at least **£12 million within two years** to avoid seeking additional shareholder funding.

## Exhibit 2 — Customer economics

| Segment | Active customers | Annual revenue per customer | Annual direct cost per customer | Annual attrition | Acquisition cost |
|---|---:|---:|---:|---:|---:|
| Everyday banking | 430,000 | £98 | £91 | 8% | £31 |
| Young professionals | 290,000 | £142 | £112 | 13% | £46 |
| Small businesses | 140,000 | £318 | £245 | 11% | £96 |
| Credit builder | 120,000 | £126 | £151 | 18% | £38 |

Additional research found:

- 41% of young professionals would consider paying for useful travel, budgeting and protection benefits.
- Small-business customers rate Lumen's app highly but cite slow support during urgent payment problems.
- Credit-builder customers generate the highest complaint rate and are more likely to report financial vulnerability.
- 37% of all customers hold an account with Lumen but use another bank as their primary account.

## Exhibit 3 — Service and operational evidence

| Indicator | Current position | Board risk appetite |
|---|---:|---:|
| Median customer-support response | 19 hours | Under 8 hours |
| Fraud reimbursement completed within five days | 62% | Above 90% |
| Critical technology incidents | 7 per quarter | Maximum 2 |
| Employees reporting unsustainable workload | 54% | Below 25% |
| Customer identity checks requiring manual review | 16% | Below 8% |

Operations believes rapid customer growth has outpaced controls and service capacity. Marketing believes slowing acquisition would surrender momentum to competitors.

## Exhibit 4 — Investment proposals

### Proposal A — Primary Account Growth

- **First-year investment:** £8m
- Target everyday-banking and young-professional customers with salary-switch incentives and personalised financial insights.
- Forecast 170,000 additional active primary customers by the end of year two.
- Forecast annual contribution improvement of £9m from year two.
- The forecast assumes app availability remains above 99.85% and service response stays below 12 hours.
- Incentives could attract customers who leave after the minimum qualifying period.

### Proposal B — Small Business Plus

- **First-year investment:** £7m
- Add invoicing, cash-flow alerts and priority payment support for a £12 monthly subscription.
- Forecast 42,000 subscribers by the end of year two.
- Forecast annual contribution improvement of £6m from year two.
- Requires 55 specialist support hires and a third-party accounting-software integration.
- Customer interviews are positive, but only 120 businesses participated in the research.

### Proposal C — Resilience and Fraud Programme

- **First-year investment:** £10m
- Modernise transaction monitoring, automate selected identity checks and remove two known single points of technology failure.
- Forecast annual loss and operating-cost reduction of £7m from year two.
- Expected to cut critical incidents by 60% and fraud losses by 35%.
- Delivers no direct new revenue and would use many of the engineers required by Proposals A and B.
- The chief risk officer considers at least £8m of this work unavoidable within 18 months.

### Proposal D — Fair Credit Rebuild

- **First-year investment:** £6m
- Redesign the credit-builder product, introduce early financial-difficulty support and simplify fees.
- Forecast annual contribution improvement of £2m from year two.
- Expected to reduce complaints in the segment by 40% and attrition by five percentage points.
- Benefits depend on customers engaging with support before missing payments.
- Consumer advocates support the proposal; some shareholders question its financial return.

## Exhibit 5 — Delivery constraints

- Lumen has capacity for **two major technology workstreams at a time**.
- Proposal C consumes one full workstream. A, B and D each consume half a workstream.
- No more than **£12m may be spent in the first six months**.
- The regulator has requested a board-approved fraud and operational-resilience plan within 90 days.
- Employee turnover in engineering and customer operations is already 21%.
- Forecast financial benefits are management estimates, not guaranteed outcomes.

## Exhibit 6 — Executive perspectives

> **Chief executive:** “Growth remains our advantage, but another funding round would be expensive and distracting.”

> **Chief financial officer:** “I need a credible route to at least £12m of annual improvement, with evidence before we scale.”

> **Chief risk officer:** “Customer growth built on fragile controls is not sustainable growth.”

> **Chief customer officer:** “We cannot call ourselves customer-led while vulnerable customers wait days for help.”

> **Chief technology officer:** “The portfolio matters as much as the individual projects. We cannot promise four transformations with the same people.”
$case$,
  deliverable=$case$
Prepare a **six-minute executive recommendation** covering:

1. Your diagnosis of Lumen's central problem.
2. The decision criteria your group used and why.
3. The proposal or portfolio you would fund within the £18m limit.
4. The sequence for the first six months and the following six months.
5. The expected financial, customer and risk outcomes.
6. The two most important assumptions or risks.
7. Three measures the board should review after 90 days.

Be prepared to answer:

- What did you choose not to fund?
- How does your portfolio reach the £12m contribution requirement?
- What evidence would cause you to change your recommendation?
- Who might be disadvantaged by your choice, and how would you respond?
$case$,
  observer_rubric=$case$
## Facilitator guide

There is no single mandatory portfolio. Assess the quality of the group's reasoning and interaction, not whether it reproduces a model answer.

### A defensible interpretation

The evidence suggests Lumen has a **quality-of-growth problem**, not simply a shortage of customers. Revenue and customers are rising while operating losses, complaints, fraud and technology incidents worsen.

One strong portfolio is **Proposal C (£10m) plus Proposal B (£7m)**, leaving £1m unallocated as contingency:

- C responds to the regulatory deadline, protects the assumptions underpinning every growth proposal and contributes an estimated £7m annually.
- B targets the segment with the strongest current unit economics and contributes an estimated £6m annually.
- Combined estimated annual improvement is £13m from year two, exceeding the £12m requirement.
- The portfolio fits the £18m cap and uses 1.5 technology workstreams.
- A credible sequence is to begin the mandatory £8m core of C and B's customer validation/service hiring in the first six months, keeping first-half spend within £12m. Release remaining investment after agreed evidence gates.

Another defensible answer could fund **C plus A**, but the group should identify that their £17m combined forecast improvement depends on service and app conditions that are currently not met. A thoughtful group may stage A behind resilience milestones.

Proposal D has important fairness benefits. Strong groups should not dismiss it solely because its financial return is smaller; they may incorporate lower-cost elements into the resilience programme or explain why it should be the next priority.

### Evidence of strong performance

- Frames the problem before debating preferred projects.
- Creates and applies consistent criteria: strategic necessity, financial contribution, customer outcome, risk, deliverability and evidence confidence.
- Checks the £18m budget, first-six-month spending limit and technology capacity.
- Challenges management forecasts and distinguishes expected value from certainty.
- Addresses the regulatory deadline and vulnerable-customer impact.
- Converts disagreement into a clearer decision rather than voting immediately.
- Produces a sequenced recommendation with owners, evidence gates and measures.

### Watch-outs

- Adding forecast benefits without discussing dependencies or double counting.
- Selecting the highest headline return while ignoring operational prerequisites.
- Treating compliance and resilience as optional because they do not create revenue.
- Inventing external banking facts rather than using the supplied case evidence.
- Allowing one participant to dominate calculations or the final presentation.

### Suggested challenge questions

1. Why is your portfolio better than funding C alone and preserving cash?
2. Which forecast assumption has the weakest evidence?
3. How would your answer change if only £14m were available?
4. What customer harm could your recommendation create?
5. What should management learn before releasing the second tranche of funding?
$case$,
  debrief_questions=array[
    'Did the group agree criteria before discussing preferred proposals?',
    'Which piece of evidence most changed the group''s initial position?',
    'How did the group distinguish regulatory necessity from commercial attractiveness?',
    'Were financial benefits tested for assumptions, dependencies or possible double counting?',
    'Whose perspective received the least attention?',
    'How effectively did participants invite challenge and synthesise disagreement?',
    'What would make the recommendation more convincing to the executive committee?'
  ],
  updated_at=now(),
  version=version+1
where stable_key='library_02_revenue_growth';

do $$
begin
  if not exists(select 1 from app.group_mock_material where stable_key='library_02_revenue_growth' and version>=2) then
    raise exception 'Flagship Group Mock source case was not found';
  end if;
end $$;

commit;
