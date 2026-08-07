# Answer Coach prompt pack v2

**Status:** Implemented local pilot; production member-data approval pending

**Prompt ID:** `answer_coach`

**Version:** `2`

**Owner:** Product

**Review date:** Before first production member pilot

## Purpose

Give a UK graduate applicant question-specific, source-anchored coaching and one editable suggested answer without inventing experience or turning the product into a chatbot.

## Permitted inputs

- question text and stable question family;
- the member's answer, split by the application into deterministic labelled segments;
- member-entered key points; and
- no more than three member-linked evidence stories.

Do not include profile data, unrelated applications, private notes, email addresses, analytics identifiers or unselected stories.

## Question-specific method

- **Personal introduction:** a selective professional story using current position, relevant past evidence and a credible next step. Avoid autobiography and usually keep the spoken answer within roughly 120–220 words.
- **Organisation motivation:** specific, evidenced reasons rather than prestige or flattery. Never invent organisation research.
- **Role motivation:** understanding of the work, genuine reasons and evidence of fit.
- **Why the candidate:** two or three relevant claims supported by evidence.
- **Competency:** STAR, with brief situation/task and most attention on first-person action, judgement, result and useful reflection.

Across every family, preserve the member's spoken voice. Diagnose irrelevant detail, repetition, vague or unsupported claims, weak openings and closings, unnatural polish and answers that are materially too short or long. Do not penalise a member merely for using English as an additional language.

Never infer an achieved effect from the stated purpose of an action or artefact. Apply the five categories according to their actual rubric rather than defaulting to Evidence; when four or more comments genuinely cover different issues, normally use at least three categories.

## Anchoring contract

The application supplies `answerSegments` such as `{"id":"a3","text":"exact source sentence"}`. The model selects an `anchorId`; it never reproduces source offsets or quotes. The application resolves that stable ID back to an exact source range and rejects missing or duplicated IDs. A substantive answer should normally receive three to five comments on distinct segments.

## Response contract

```json
{
  "summary": "one concise sentence",
  "strengths": ["up to two"],
  "comments": [
    {
      "anchorId": "a1",
      "category": "Evidence | Reasoning | Relevance | Structure | Reflection",
      "observation": "specific diagnosis and why an assessor would care",
      "coachingQuestion": "one focused decision question",
      "optionalRevision": "grounded local rewrite or null"
    }
  ],
  "suggestedAnswer": "complete grounded revision or null",
  "followUpQuestions": ["up to three"],
  "unsupportedClaimsDetected": ["up to three claims from the source"]
}
```

For an answer with roughly 25 or more useful words, `suggestedAnswer` should normally be a complete, natural revision. It may reorder, shorten, clarify and omit irrelevant material. It must use only supplied facts. Unsupported source claims may be omitted; their presence does not by itself suppress an otherwise grounded revision.

The member can edit the suggestion before accepting it. Copying it into the answer and saving it are explicit actions. Nothing is applied automatically.

## Runtime envelope

- Provider-neutral model boundary; DeepSeek V4 Flash is the current local pilot adapter.
- JSON output mode with an explicit example shape.
- Non-thinking mode, temperature `0.2`, maximum output `2,200` tokens.
- One bounded retry for malformed, truncated or invalidly anchored output.
- Deterministic local-rubric fallback, clearly identified as limited and without a generated answer.
- Strict schema, exact resolved anchors, numeric-claim grounding, inferred-outcome grounding and output-length validation.

## Evaluation

The synthetic set covers strong and weak competency answers, unsupported numbers, prompt injection, conflicting evidence, concise additional-language English, introductions, generic organisation motivation, specific role motivation and machine-like wording. Human review must score grounding, usefulness, question-family fit, voice preservation, comment coverage and suggested-answer quality before production approval.
