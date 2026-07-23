export type DemoResource = Readonly<{
  key: string;
  slug: string;
  title: string;
  description: string;
  type: "guide" | "checklist" | "exercise";
  minutes: number;
  category: string;
  stages: readonly string[];
  body: string;
}>;

const guide = (
  purpose: string,
  framework: string,
  guidance: readonly string[],
  mistakes: readonly string[],
  action: string,
) =>
  `## Purpose\n\n${purpose}\n\n## A practical framework\n\n${framework}\n\n## How to use it\n\n${guidance.map((x) => `- ${x}`).join("\n")}\n\n## Common mistakes\n\n${mistakes.map((x) => `- ${x}`).join("\n")}\n\n## Take action\n\n${action}`;
const checklist = (purpose: string, checks: readonly string[], review: string) =>
  `## Purpose\n\n${purpose}\n\n## Checklist\n\n${checks.map((x) => `- [ ] ${x}`).join("\n")}\n\n## Final review\n\n${review}`;
const exercise = (
  purpose: string,
  instructions: string,
  prompts: readonly string[],
  output: string,
  review: readonly string[],
) =>
  `## Purpose\n\n${purpose}\n\n## Instructions\n\n${instructions}\n\n## Prompts\n\n${prompts.map((x) => `- ${x}`).join("\n")}\n\n## Expected output\n\n${output}\n\n## Review your work\n\n${review.map((x) => `- ${x}`).join("\n")}`;

const r = (
  key: string,
  title: string,
  type: DemoResource["type"],
  minutes: number,
  category: string,
  stages: string[],
  description: string,
  body: string,
): DemoResource => ({
  key: `learn_demo_${key}`,
  slug: key.replaceAll("_", "-"),
  title,
  type,
  minutes,
  category,
  stages,
  description,
  body,
});

export const demoResources: readonly DemoResource[] = [
  r(
    "tell_me_about_yourself",
    "Tell Me About Yourself: Past–Present–Future",
    "guide",
    12,
    "interviews",
    ["video_interview", "interview"],
    "Build a concise, relevant introduction that connects your experience to the opportunity.",
    guide(
      "Understand what employers need from an opening introduction and shape a focused response.",
      "Past → Present → Future",
      [
        "Choose one past experience that explains your direction.",
        "Describe the relevant work, skills or responsibilities you have now.",
        "Connect your next step directly to this role and organisation.",
        "Aim for roughly 90 seconds and lead with relevance.",
      ],
      [
        "Retelling your complete life history.",
        "Listing skills without evidence.",
        "Ending without explaining why this opportunity follows logically.",
      ],
      "Write three sentences—one for each part—then read them aloud and remove anything that does not help the interviewer understand your fit.",
    ),
  ),
  r(
    "draft_90_second_introduction",
    "Draft Your 90-Second Introduction",
    "exercise",
    20,
    "interviews",
    ["video_interview", "interview"],
    "Draft and refine a focused opening answer for interviews.",
    exercise(
      "Turn Past–Present–Future into a natural spoken introduction.",
      "Write a first draft, time it aloud, then edit for relevance and clarity.",
      [
        "Past: What experience first moved you towards this field?",
        "Present: What relevant skills or responsibilities do you have now?",
        "Future: Why is this opportunity the logical next step?",
      ],
      "A spoken introduction of 75–90 seconds with a clear link to the role.",
      [
        "Can a listener follow the direction of your story?",
        "Is every detail relevant?",
        "Does the final sentence name the contribution you hope to make?",
      ],
    ),
  ),
  r(
    "why_this_organisation",
    "Why This Organisation?",
    "guide",
    15,
    "interviews",
    ["video_interview", "interview"],
    "Connect specific organisational research to your motivation and intended contribution.",
    guide(
      "Build a motivation answer that could only describe the organisation you are applying to.",
      "Specific evidence + personal connection + role relevance + intended contribution",
      [
        "Select two specific facts about priorities, customers, work or culture.",
        "Explain why each fact matters to you rather than merely repeating it.",
        "Link the evidence to the role's actual responsibilities.",
        "Finish with how you hope to contribute.",
      ],
      [
        "Relying on reputation or size alone.",
        "Copying the organisation's website language.",
        "Making claims you cannot support.",
      ],
      "Draft four bullets following the framework and identify the source for every organisational claim.",
    ),
  ),
  r(
    "why_this_role",
    "Why This Role?",
    "exercise",
    20,
    "interviews",
    ["video_interview", "interview"],
    "Create a role-specific motivation answer grounded in responsibilities and evidence.",
    exercise(
      "Match what the role requires with what you enjoy, can evidence and want to develop.",
      "Annotate the role description, choose three responsibilities, and draft a short connection for each.",
      [
        "Which responsibility interests you most, and why?",
        "What evidence shows you can contribute?",
        "What do you want to learn?",
        "Why is this role a logical next step?",
      ],
      "A 60–90 second answer with role evidence, personal evidence and forward motivation.",
      [
        "Would the answer fit many unrelated roles?",
        "Have you shown contribution as well as benefit?",
        "Can you support each skill claim with an example?",
      ],
    ),
  ),
  r(
    "company_role_research_checklist",
    "Company and Role Research Checklist",
    "checklist",
    15,
    "interviews",
    ["video_interview", "interview"],
    "Collect the evidence needed for specific motivation and fit answers.",
    checklist(
      "Build a compact research sheet you can use in motivation and follow-up answers.",
      [
        "Summarise the business model and main customers.",
        "Identify the role's core responsibilities and team.",
        "Highlight required skills and how they are used.",
        "Find two recent, verifiable developments.",
        "Note what genuinely connects you to the work.",
        "Record sources and dates for important claims.",
        "Write one contribution you could make in the first year.",
      ],
      "Can you explain the organisation and role accurately without reading from its website? Remove facts that do not change your answer.",
    ),
  ),
  r(
    "evidence_story_bank",
    "Evidence Story Bank",
    "exercise",
    30,
    "interviews",
    ["video_interview", "interview", "assessment_centre"],
    "Build reusable evidence stories from the full range of your experience.",
    exercise(
      "Create an inventory before writing polished STAR answers.",
      "List experiences, identify your contribution, and tag the behaviours each could evidence.",
      [
        "University projects and coursework",
        "Employment and internships",
        "Volunteering and societies",
        "Personal projects or entrepreneurship",
        "Caring responsibilities",
        "A time you changed direction after feedback",
      ],
      "A bank of six to eight experiences, each with outcome, personal actions and possible competencies.",
      [
        "Is your individual contribution clear?",
        "Do the examples cover different settings?",
        "Can one strong experience support several competencies without forcing the fit?",
      ],
    ),
  ),
  r(
    "star_reasoning_reflection",
    "STAR Plus Reasoning and Reflection",
    "guide",
    15,
    "interviews",
    ["video_interview", "interview"],
    "Make evidence answers stronger by explaining decisions and learning, not just events.",
    guide(
      "Structure evidence while keeping most of the answer on what you personally did and why.",
      "Situation → Task → Actions → Reasoning → Result → Reflection",
      [
        "Keep situation and task brief.",
        "Use 'I' to separate your contribution from the team's.",
        "Explain why you chose the important actions.",
        "Quantify or qualify the result honestly.",
        "End with learning you have used since.",
      ],
      [
        "Spending half the answer on context.",
        "Describing team actions without your role.",
        "Claiming a result with no evidence.",
        "Adding generic reflection unrelated to the example.",
      ],
      "Take one story from your bank and label each sentence against the six-part framework. Expand reasoning; cut excess context.",
    ),
  ),
  r(
    "competency_coverage_checklist",
    "Competency Coverage Checklist",
    "checklist",
    15,
    "interviews",
    ["video_interview", "interview", "assessment_centre"],
    "Check that your evidence bank covers common behaviour families without duplicating stories.",
    checklist(
      "Map experiences across common competencies; one experience may support several when the evidence is genuine.",
      [
        "Teamwork",
        "Leadership",
        "Problem solving",
        "Communication",
        "Conflict",
        "Resilience",
        "Adaptability",
        "Initiative",
        "Organisation",
        "Customer focus",
      ],
      "Mark at least two possible stories for high-priority competencies. Replace weak or repetitive examples with evidence from another setting.",
    ),
  ),
  r(
    "strengths_development_areas",
    "Strengths and Development Areas",
    "exercise",
    20,
    "interviews",
    ["interview"],
    "Prepare credible self-awareness answers supported by evidence and action.",
    exercise(
      "Choose strengths relevant to the work and a genuine development area you are actively improving.",
      "Draft one evidence-backed strength and one development response.",
      [
        "Where has a strength produced a useful outcome?",
        "What feedback supports it?",
        "Which real limitation are you improving?",
        "What action have you taken and what changed?",
      ],
      "Two concise answers: evidence for the strength; context, action and progress for the development area.",
      [
        "Is the development area genuine but manageable?",
        "Have you shown action rather than a disguised strength?",
        "Can you demonstrate recent improvement?",
      ],
    ),
  ),
  r(
    "failure_feedback_learning",
    "Failure, Feedback and Learning",
    "exercise",
    20,
    "interviews",
    ["interview"],
    "Show responsibility, learning and changed behaviour after a genuine setback.",
    exercise(
      "Select a setback you can discuss honestly without blaming others.",
      "Structure the answer around responsibility and what changed afterwards.",
      [
        "What outcome fell short?",
        "What was your responsibility?",
        "What feedback or evidence changed your view?",
        "What specific behaviour changed?",
        "Where have you demonstrated improvement since?",
      ],
      "A two-minute example ending with concrete evidence of improvement.",
      [
        "Do you own your part clearly?",
        "Is the lesson specific?",
        "Does later evidence prove the change?",
      ],
    ),
  ),
  r(
    "business_news_interview_insight",
    "From Business News to Interview Insight",
    "guide",
    20,
    "interviews",
    ["interview"],
    "Turn a relevant development into a balanced commercial view connected to the role.",
    guide(
      "Move beyond summarising headlines by explaining impact, trade-offs and relevance.",
      "Development → why it matters → customer or organisational effect → risk or opportunity → personal view → role relevance",
      [
        "Choose a recent development from a reliable source.",
        "Separate known facts from your inference.",
        "Consider more than one stakeholder.",
        "State a measured view and acknowledge uncertainty.",
        "Connect the insight to decisions in the role.",
      ],
      [
        "Reciting news with no analysis.",
        "Using outdated or unverified claims.",
        "Offering an extreme view without trade-offs.",
      ],
      "Prepare a 90-second briefing and note which statements are facts, assumptions and your own judgement.",
    ),
  ),
  r(
    "questions_for_interviewer",
    "Questions Worth Asking an Interviewer",
    "checklist",
    10,
    "interviews",
    ["video_interview", "interview"],
    "Prepare thoughtful questions that help you understand priorities, expectations and development.",
    checklist(
      "Choose questions you genuinely want answered and adapt them to the interviewer.",
      [
        "What are the team's most important current priorities?",
        "How is success measured in the first year?",
        "What challenge would the successful candidate help solve?",
        "How does the team work with other functions?",
        "What development and feedback are available?",
        "What distinguishes people who thrive in the role?",
        "Which expectation is hardest to understand from the job description?",
      ],
      "Remove questions answered clearly in public material. Prepare four and prioritise the two most useful for this conversation.",
    ),
  ),
  r(
    "recorded_video_interviews",
    "Recorded Video Interviews: What to Expect",
    "guide",
    12,
    "interviews",
    ["video_interview"],
    "Understand common recorded and live formats and what assessors can observe.",
    guide(
      "Reduce uncertainty by checking the actual platform instructions and preparing for likely question families.",
      "Format → constraints → question families → observable evidence",
      [
        "Confirm whether the interview is recorded or live.",
        "Check preparation time, answer time and retake rules.",
        "Expect motivation, competency, situational and commercial questions.",
        "Practise looking at the camera while speaking naturally.",
        "Treat the employer's instructions as authoritative.",
      ],
      [
        "Assuming every platform allows retakes.",
        "Reading a script off screen.",
        "Practising only perfect first attempts.",
      ],
      "Write down the confirmed format and constraints, then choose one practice activity for each likely question family.",
    ),
  ),
  r(
    "clear_answer_two_minutes",
    "Deliver a Clear Answer in Two Minutes",
    "guide",
    15,
    "interviews",
    ["video_interview", "interview"],
    "Shape concise answers that make the key point and evidence easy to follow.",
    guide(
      "Use limited time deliberately and prioritise your actions and reasoning.",
      "Key point → brief context → individual action and reasoning → result and learning",
      [
        "Lead with a direct answer to the question.",
        "Limit context to what the listener needs.",
        "Use signposting when the answer has several parts.",
        "Pause before the final result and learning.",
        "Record and review for clarity rather than polish alone.",
      ],
      [
        "Building suspense before answering.",
        "Using vague 'we' statements.",
        "Adding a second example when one is enough.",
      ],
      "Record a two-minute answer, transcribe its main points, and cut any sentence that does not answer the question or support the evidence.",
    ),
  ),
  r(
    "timed_video_answer_practice",
    "Timed Video Answer Practice",
    "exercise",
    25,
    "interviews",
    ["video_interview"],
    "Practise five synthetic question families under realistic time limits.",
    exercise(
      "Complete five recordings with 30 seconds to prepare and two minutes to answer each.",
      "Do one continuous practice round before reviewing; these prompts are synthetic and not from a named employer.",
      [
        "Introduce yourself and explain your direction.",
        "Explain your motivation for this opportunity.",
        "Describe a time you helped a team succeed.",
        "Describe a challenge and how you responded.",
        "Discuss a development relevant to the organisation.",
      ],
      "Five recordings plus one improvement note for clarity, evidence and delivery on each.",
      [
        "Did you answer immediately?",
        "Was your individual contribution specific?",
        "Did you finish within time without rushing?",
      ],
    ),
  ),
  r(
    "recording_environment_checklist",
    "Recording Environment Checklist",
    "checklist",
    8,
    "interviews",
    ["video_interview"],
    "Set up a reliable, professional recording environment before the interview.",
    checklist(
      "Test the complete setup early enough to fix problems.",
      [
        "Camera is stable and at eye level.",
        "Microphone is clear with no distracting echo.",
        "Face is evenly lit and visible.",
        "Framing leaves comfortable space around head and shoulders.",
        "Background is tidy and non-distracting.",
        "Internet connection is stable.",
        "Browser permissions for camera and microphone work.",
        "Notifications and avoidable interruptions are disabled.",
        "Device is powered or charging.",
      ],
      "Make a short test recording in the exact location and review both audio and video on another device if possible.",
    ),
  ),
  r(
    "video_interview_final_rehearsal",
    "Video Interview Final Rehearsal",
    "exercise",
    30,
    "interviews",
    ["video_interview"],
    "Complete a realistic rehearsal and turn observations into a short final improvement plan.",
    exercise(
      "Record a six-question rehearsal in one sitting, using the confirmed interview timings.",
      "Use your prepared question families but do not read scripts.",
      [
        "Opening introduction",
        "Organisation motivation",
        "Role motivation",
        "Competency evidence",
        "Challenge or learning",
        "Relevant development",
      ],
      "Six recordings and no more than three specific changes for the final interview.",
      [
        "Answer length and clarity",
        "Specificity and individual contribution",
        "Eye line, pace and repetition",
        "Technical quality",
        "Whether the ending answers the question",
      ],
    ),
  ),
  r(
    "assessment_centres_overview",
    "Assessment Centres: What Employers Assess",
    "guide",
    15,
    "assessment-centres",
    ["assessment_centre"],
    "Understand how multiple exercises provide evidence of behaviour, judgement and communication.",
    guide(
      "Treat the day as several opportunities to demonstrate relevant behaviours, not a single performance.",
      "Exercise objective → assessed behaviours → observable choices → reflection and reset",
      [
        "Review the agenda and instructions for each exercise.",
        "Focus on useful contribution rather than visibility alone.",
        "Listen, prioritise and communicate your reasoning.",
        "Reset after every exercise instead of judging your performance mid-day.",
      ],
      [
        "Trying to dominate every exercise.",
        "Assuming one mistake determines the result.",
        "Ignoring the written objective while performing a preferred role.",
      ],
      "For each expected exercise, list two behaviours you want to demonstrate and what an assessor could actually observe.",
    ),
  ),
  r(
    "group_exercise_behaviours",
    "Group Exercise Behaviours",
    "guide",
    20,
    "assessment-centres",
    ["assessment_centre"],
    "Contribute ideas while helping the group understand, decide and deliver.",
    guide(
      "Balance task progress with inclusive collaboration.",
      "Clarify objective → contribute → invite → test → decide → summarise",
      [
        "Offer ideas with a reason, not volume alone.",
        "Invite quieter participants and build on useful suggestions.",
        "Monitor time and return the group to the objective.",
        "Handle disagreement by testing criteria and trade-offs.",
        "Summarise decisions and open questions.",
      ],
      [
        "Competing to speak most.",
        "Agreeing with everything to appear collaborative.",
        "Timekeeping without contributing to the substance.",
      ],
      "Observe a group discussion or practise with peers and record one example of each behaviour in the framework.",
    ),
  ),
  r(
    "group_exercise_practice_checklist",
    "Group Exercise Practice Checklist",
    "checklist",
    10,
    "assessment-centres",
    ["assessment_centre"],
    "Review whether your group contribution supports both the task and other participants.",
    checklist(
      "Use after a practice discussion.",
      [
        "Clarified the objective and constraints.",
        "Contributed at least one reasoned idea.",
        "Built on another person's suggestion.",
        "Invited or acknowledged another participant.",
        "Tested options against shared criteria.",
        "Handled disagreement constructively.",
        "Kept time without interrupting progress.",
        "Helped the group reach and summarise a decision.",
      ],
      "Choose one task behaviour and one collaboration behaviour to improve in the next practice.",
    ),
  ),
  r(
    "case_study_structure",
    "Case Study: Structure Before Detail",
    "guide",
    25,
    "assessment-centres",
    ["assessment_centre"],
    "Analyse unfamiliar information and make a clear, qualified recommendation.",
    guide(
      "Create a decision structure before reading every detail.",
      "Define question → prioritise information → identify assumptions → compare options → recommend → explain risks",
      [
        "Rewrite the decision in one sentence.",
        "Separate must-know evidence from interesting detail.",
        "Use consistent criteria to compare options.",
        "State assumptions and test sensitivity.",
        "Recommend clearly and name the main risk and mitigation.",
      ],
      [
        "Summarising all information without deciding.",
        "Changing criteria between options.",
        "Hiding uncertainty instead of managing it.",
      ],
      "Take a short business article and produce a one-page recommendation using the framework, including two assumptions and one alternative.",
    ),
  ),
  r(
    "assessment_presentation",
    "Build a Clear Assessment-Centre Presentation",
    "guide",
    20,
    "assessment-centres",
    ["assessment_centre"],
    "Turn analysis into a concise presentation with a clear recommendation and defensible logic.",
    guide(
      "Design around the audience's decision rather than around every fact you found.",
      "Answer → supporting reasons → evidence → risks → next steps",
      [
        "State the recommendation in the opening.",
        "Use two or three mutually distinct supporting reasons.",
        "Make evidence readable and explain why it matters.",
        "Acknowledge a significant risk and response.",
        "Reserve time for questions.",
      ],
      [
        "Saving the recommendation for the end.",
        "Crowding slides with source material.",
        "Reading rather than explaining.",
      ],
      "Create a five-minute outline with one sentence per section, then practise answering 'why?' after every claim.",
    ),
  ),
  r(
    "written_exercise_checklist",
    "Written Exercise Checklist",
    "checklist",
    15,
    "assessment-centres",
    ["assessment_centre"],
    "Produce a clear, accurate response under time pressure.",
    checklist(
      "Plan before writing and leave time to check the decision and detail.",
      [
        "Identify audience, required output and deadline.",
        "Underline the decision or action requested.",
        "Allocate time for reading, planning, writing and checking.",
        "Prioritise evidence and separate facts from assumptions.",
        "Use headings and direct topic sentences.",
        "State a clear recommendation or next action.",
        "Check numbers, names, tone and internal consistency.",
        "Remove material that does not serve the brief.",
      ],
      "Can the reader find the conclusion, reasons, risks and next action in under one minute?",
    ),
  ),
  r(
    "assessment_centre_final_checklist",
    "Assessment Centre Final Checklist",
    "checklist",
    10,
    "assessment-centres",
    ["assessment_centre"],
    "Confirm the practical details that let you focus on the exercises.",
    checklist(
      "Complete the evening before and recheck essential details on the day.",
      [
        "Date, start time, time zone and format confirmed.",
        "Travel route or video links tested.",
        "Required identification and materials packed.",
        "Dress expectations understood.",
        "Accessibility adjustments confirmed where relevant.",
        "Organisation and role research refreshed.",
        "Water, food and breaks planned.",
        "Contact details saved for genuine problems.",
        "A reset routine chosen between exercises.",
      ],
      "Explain your schedule and contingency plan to yourself in one minute. Fix any detail you cannot state confidently.",
    ),
  ),
  r(
    "online_assessments_format",
    "Online Assessments: Know the Format",
    "guide",
    12,
    "online-assessments",
    ["online_assessment"],
    "Identify likely assessment formats and use official instructions to plan relevant practice.",
    guide(
      "Start with the invitation and provider information; practise the actual skill and timing required.",
      "Format → instructions → example items → timing → practice plan",
      [
        "Record the assessment name, provider and deadline.",
        "Check whether it is timed, adaptive or remotely supervised.",
        "Use official examples before third-party practice.",
        "Identify accuracy, speed or judgement demands.",
        "Schedule short practice and review sessions.",
      ],
      [
        "Assuming all numerical or verbal tests work alike.",
        "Practising volume without reviewing errors.",
        "Ignoring accessibility or technical instructions until test day.",
      ],
      "Create a one-page assessment brief with format, timing, rules, deadline and the next three practice sessions.",
    ),
  ),
  r(
    "numerical_reasoning_strategy",
    "Numerical Reasoning Practice Strategy",
    "guide",
    20,
    "online-assessments",
    ["online_assessment"],
    "Improve numerical reasoning through targeted practice and error review.",
    guide(
      "Use a repeatable method and diagnose errors by type.",
      "Question → relevant data → operation → estimate → calculate → sense-check",
      [
        "Read the question before scanning the table or chart.",
        "Write units and convert them consistently.",
        "Estimate the expected range before calculating.",
        "Track whether errors come from interpretation, method, arithmetic or time.",
        "Repeat weak question types after review.",
      ],
      [
        "Calculating before identifying what is asked.",
        "Chasing one difficult item beyond its value.",
        "Reviewing only the final score.",
      ],
      "Complete a short timed set and classify every error. Choose one error category for the next practice session.",
    ),
  ),
  r(
    "verbal_reasoning_strategy",
    "Verbal Reasoning Practice Strategy",
    "guide",
    20,
    "online-assessments",
    ["online_assessment"],
    "Answer verbal reasoning items from the passage rather than prior knowledge.",
    guide(
      "Distinguish what the text supports, contradicts or does not establish.",
      "Claim → locate evidence → test wording → answer only from passage",
      [
        "Read qualifiers such as all, some, may and must carefully.",
        "Find the exact sentence or combination of sentences.",
        "Treat plausible outside knowledge as irrelevant.",
        "Separate false from cannot say.",
        "Review why each rejected option fails.",
      ],
      [
        "Inferring more than the passage states.",
        "Matching keywords without checking meaning.",
        "Changing the answer because it seems unrealistic.",
      ],
      "Complete ten items and write the supporting phrase beside each answer. Flag where the wording changed the strength of a claim.",
    ),
  ),
  r(
    "situational_judgement_framework",
    "Situational Judgement Decision Framework",
    "guide",
    20,
    "online-assessments",
    ["online_assessment"],
    "Evaluate workplace responses using objectives, stakeholders, policy and proportionate ownership.",
    guide(
      "Judge the likely effectiveness of each response in the stated context.",
      "Clarify objective → protect customers and colleagues → follow policy → take proportionate ownership → escalate appropriately",
      [
        "Identify the immediate risk and who is affected.",
        "Prefer actions that gather essential information and address the issue.",
        "Respect role boundaries without avoiding responsibility.",
        "Use escalation when risk, authority or policy requires it.",
        "Compare options rather than searching for a perfect response.",
      ],
      [
        "Choosing extreme action too early.",
        "Ignoring the problem to preserve harmony.",
        "Assuming facts not given in the scenario.",
      ],
      "For five synthetic situations, rank the responses and write one sentence explaining the strongest and weakest choice.",
    ),
  ),
  r(
    "timed_assessment_routine",
    "Build a Timed-Practice Routine",
    "exercise",
    20,
    "online-assessments",
    ["online_assessment"],
    "Create a short practice cycle that improves accuracy, pacing and review quality.",
    exercise(
      "Plan three sessions using the actual assessment format where possible.",
      "Alternate targeted practice with timed mixed sets and error review.",
      [
        "Which format and provider are you preparing for?",
        "Which error type costs most marks or time?",
        "What pace is required per item?",
        "When will you repeat previously missed item types?",
      ],
      "A three-session timetable with format, duration, target skill and review method for each session.",
      [
        "Does every session include review?",
        "Is the target specific enough to measure?",
        "Is rest scheduled before the real assessment?",
      ],
    ),
  ),
  r(
    "online_assessment_environment",
    "Online Assessment Environment Checklist",
    "checklist",
    10,
    "online-assessments",
    ["online_assessment"],
    "Prepare a compliant, reliable test environment.",
    checklist(
      "Follow the provider's instructions where they differ from this general list.",
      [
        "Supported device and browser confirmed.",
        "System check and sample item completed.",
        "Stable internet and power available.",
        "Quiet location reserved for the full window.",
        "Permitted calculator, paper or materials understood.",
        "Camera and microphone permissions tested if required.",
        "Notifications and background downloads stopped.",
        "Deadline and time zone checked.",
        "Support contact and contingency steps saved.",
      ],
      "Run the official system check again shortly before starting and do not begin until you can complete the full assessment uninterrupted.",
    ),
  ),
  r(
    "final_interview_objective",
    "What Changes in a Final Interview?",
    "guide",
    12,
    "interviews",
    ["interview"],
    "Prepare for deeper examination of motivation, consistency, judgement and role fit.",
    guide(
      "Expect familiar themes to be tested through follow-up questions and a senior stakeholder lens.",
      "Evidence depth + consistent motivation + judgement + self-awareness + concise senior communication",
      [
        "Review what you said at earlier stages.",
        "Prepare evidence behind every important claim.",
        "Explain trade-offs and reasoning, not just actions.",
        "Connect commercial context to the team's priorities.",
        "Keep answers direct while welcoming follow-up questions.",
      ],
      [
        "Inventing new motivation late in the process.",
        "Repeating memorised answers despite a different question.",
        "Treating seniority as a cue to become vague or overly formal.",
      ],
      "List five claims you expect to make and the follow-up evidence or reasoning that supports each one.",
    ),
  ),
  r(
    "final_interview_follow_up",
    "Final Interview Follow-Up Rehearsal",
    "exercise",
    25,
    "interviews",
    ["interview"],
    "Practise staying clear and credible when an interviewer probes your first answer.",
    exercise(
      "Ask a practice partner to choose follow-ups without telling you in advance, or use the prompts yourself after a pause.",
      "Answer an initial question, then complete three layers of probing.",
      [
        "What specifically did you do?",
        "Why did you choose that approach?",
        "What alternative did you consider?",
        "What would you change now?",
        "How is this relevant to the role?",
      ],
      "Three recorded answers with follow-ups and a note on where evidence, reasoning or reflection became weak.",
      [
        "Did your details remain consistent?",
        "Could you acknowledge uncertainty honestly?",
        "Did each follow-up add useful depth rather than repetition?",
      ],
    ),
  ),
  r(
    "final_interview_logistics",
    "Final Interview Logistics Checklist",
    "checklist",
    8,
    "interviews",
    ["interview"],
    "Remove avoidable practical uncertainty before a high-stakes final conversation.",
    checklist(
      "Confirm the format and prepare for the people and setting named in the invitation.",
      [
        "Time, time zone, location or meeting link confirmed.",
        "Interviewer names and roles checked using appropriate public information.",
        "Travel or technology tested with contingency time.",
        "Role description and submitted application available for review.",
        "Key motivation, evidence and commercial notes condensed to one page.",
        "Questions prioritised for likely interviewers.",
        "Required documents and identification ready.",
        "Contact route saved for genuine delays or access problems.",
      ],
      "Stop intensive preparation early enough to rest. On the day, review only the concise sheet and practical details.",
    ),
  ),
];

export type DemoPlan = Readonly<{
  key: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  introduction: string;
  sections: readonly Readonly<{
    heading: string;
    description: string;
    resources: readonly string[];
  }>[];
}>;
const s = (heading: string, description: string, resources: string[]) => ({
  heading,
  description,
  resources: resources.map((key) => `learn_demo_${key}`),
});
export const demoPlans: readonly DemoPlan[] = [
  {
    key: "build_interview_answer_bank",
    slug: "build-your-interview-answer-bank",
    title: "Build Your Interview Answer Bank",
    description:
      "Build reusable answers and evidence stories for the question families used across video, live and final interviews.",
    category: "interviews",
    introduction:
      "Use this foundational plan to create a reusable bank. Adapt your evidence honestly for each opportunity rather than memorising scripts.",
    sections: [
      s(
        "Create your personal introduction",
        "Build a concise introduction that connects your direction to the opportunity.",
        ["tell_me_about_yourself", "draft_90_second_introduction"],
      ),
      s(
        "Prepare motivation and fit",
        "Connect organisation and role research to specific personal motivation.",
        ["why_this_organisation", "why_this_role", "company_role_research_checklist"],
      ),
      s(
        "Build your evidence story bank",
        "Find, structure and map evidence from the full range of your experience.",
        ["evidence_story_bank", "star_reasoning_reflection", "competency_coverage_checklist"],
      ),
      s("Prepare self-awareness answers", "Show credible strengths, development and learning.", [
        "strengths_development_areas",
        "failure_feedback_learning",
      ]),
      s(
        "Build commercial awareness",
        "Turn relevant developments into balanced interview insight.",
        ["business_news_interview_insight"],
      ),
      s(
        "Prepare questions to ask",
        "Choose useful questions about priorities, success and expectations.",
        ["questions_for_interviewer"],
      ),
    ],
  },
  {
    key: "prepare_video_interview",
    slug: "video-interview-preparation",
    title: "Video Interview Preparation",
    description:
      "Prepare your core answers, evidence, delivery and technical setup for a recorded or live video interview.",
    category: "interviews",
    introduction:
      "Work through every area, then rehearse under the timing and rules in your actual invitation.",
    sections: [
      s(
        "Understand the format",
        "Confirm the platform constraints and what assessors can observe.",
        ["recorded_video_interviews"],
      ),
      s("Prepare core answers", "Build concise introduction, motivation and role-fit answers.", [
        "tell_me_about_yourself",
        "why_this_organisation",
        "why_this_role",
        "company_role_research_checklist",
      ]),
      s("Prepare evidence stories", "Choose evidence and make your personal contribution clear.", [
        "evidence_story_bank",
        "star_reasoning_reflection",
        "competency_coverage_checklist",
      ]),
      s("Practise concise delivery", "Answer directly and practise realistic time limits.", [
        "clear_answer_two_minutes",
        "timed_video_answer_practice",
      ]),
      s("Complete technical setup", "Test the full recording environment before the deadline.", [
        "recording_environment_checklist",
      ]),
      s(
        "Complete a final rehearsal",
        "Run one full practice and prioritise the last improvements.",
        ["video_interview_final_rehearsal"],
      ),
    ],
  },
  {
    key: "prepare_group_exercise",
    slug: "assessment-centre-preparation",
    title: "Assessment Centre Preparation",
    description:
      "Prepare for group exercises, case studies, presentations, written tasks and assessment-centre interviews.",
    category: "assessment-centres",
    introduction:
      "Prepare for the range of exercises while remembering that useful, observable behaviour matters more than performing a fixed persona.",
    sections: [
      s("Understand the assessment centre", "Know how exercises produce evidence across the day.", [
        "assessment_centres_overview",
      ]),
      s("Prepare for a group exercise", "Contribute to the task and help the group work well.", [
        "group_exercise_behaviours",
        "group_exercise_practice_checklist",
      ]),
      s(
        "Prepare for a case study",
        "Structure unfamiliar information and make a qualified recommendation.",
        ["case_study_structure"],
      ),
      s("Prepare a presentation", "Communicate the answer, reasons, risks and next steps.", [
        "assessment_presentation",
      ]),
      s("Prepare for a written exercise", "Write a useful response under time pressure.", [
        "written_exercise_checklist",
      ]),
      s(
        "Prepare for interview questions",
        "Refresh evidence stories likely to be tested alongside exercises.",
        ["evidence_story_bank", "star_reasoning_reflection", "competency_coverage_checklist"],
      ),
      s("Plan assessment-centre logistics", "Confirm the practical details and a reset routine.", [
        "assessment_centre_final_checklist",
      ]),
    ],
  },
  {
    key: "prepare_online_assessment",
    slug: "online-assessment-preparation",
    title: "Online Assessment Preparation",
    description:
      "Understand likely test formats, practise with a clear strategy and prepare a reliable test environment.",
    category: "online-assessments",
    introduction:
      "Use the employer and provider instructions as the authority, then focus practice on the format and errors that matter.",
    sections: [
      s("Identify the tests", "Confirm formats, rules, timing and the provider.", [
        "online_assessments_format",
      ]),
      s("Prepare numerical reasoning", "Use a consistent method and diagnose errors.", [
        "numerical_reasoning_strategy",
      ]),
      s("Prepare verbal reasoning", "Base answers only on what the passage establishes.", [
        "verbal_reasoning_strategy",
      ]),
      s(
        "Prepare situational judgement",
        "Compare responses using objectives, stakeholders and proportionate ownership.",
        ["situational_judgement_framework"],
      ),
      s("Build a timed-practice routine", "Combine targeted work, timed practice and review.", [
        "timed_assessment_routine",
      ]),
      s("Complete technical setup", "Test the environment and understand permitted materials.", [
        "online_assessment_environment",
      ]),
    ],
  },
  {
    key: "prepare_final_interview",
    slug: "final-interview-preparation",
    title: "Final Interview Preparation",
    description:
      "Refine your motivation, evidence, commercial understanding and questions for a high-stakes final conversation.",
    category: "interviews",
    introduction:
      "Consolidate earlier preparation, check consistency and rehearse the deeper follow-up questions common at a final stage.",
    sections: [
      s(
        "Understand the final-stage objective",
        "Prepare for greater depth, judgement and senior-stakeholder communication.",
        ["final_interview_objective"],
      ),
      s(
        "Refine motivation and fit",
        "Make motivation specific, consistent and grounded in current research.",
        ["why_this_organisation", "why_this_role", "company_role_research_checklist"],
      ),
      s(
        "Review evidence stories",
        "Check coverage, reasoning and results in your strongest examples.",
        ["evidence_story_bank", "star_reasoning_reflection", "competency_coverage_checklist"],
      ),
      s(
        "Prepare self-awareness",
        "Demonstrate responsibility, feedback and continued development.",
        ["strengths_development_areas", "failure_feedback_learning"],
      ),
      s("Strengthen commercial awareness", "Prepare a measured view of a relevant development.", [
        "business_news_interview_insight",
      ]),
      s(
        "Prepare questions for senior interviewers",
        "Prioritise questions about direction, challenges and success.",
        ["questions_for_interviewer"],
      ),
      s(
        "Rehearse follow-up questions",
        "Test the depth and consistency behind your first answer.",
        ["clear_answer_two_minutes", "final_interview_follow_up"],
      ),
      s("Complete final logistics", "Confirm the people, format, materials and contingency plan.", [
        "final_interview_logistics",
      ]),
    ],
  },
];

export function isLocalDatabaseUrl(value: string) {
  try {
    const host = new URL(value).hostname;
    return (
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "db" ||
      host === "supabase_db_offerlab"
    );
  } catch {
    return false;
  }
}

export function demoStableKeys() {
  return {
    resources: demoResources.map((item) => item.key),
    plans: demoPlans.map((item) => item.key),
  };
}
