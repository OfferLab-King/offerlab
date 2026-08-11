# OfferLab UI and UX design system

**Status:** Approved visual implementation standard  
**Date:** 2026-07-24  
**Authority:** Applies to all new and changed OfferLab interfaces. It is subordinate to
`experience-principles.md` for interaction behaviour and to
`product-strategy-and-roadmap.md` for product hierarchy.

## Purpose

OfferLab should feel like a calm, credible preparation workspace: precise enough for enterprise
software, warm enough for graduates, and distinctive without looking ornamental. Professional
quality means that navigation, spacing, controls and states behave consistently across every route,
not that every screen receives more decoration.

## Reference review

The direction was informed by patterns across [Mobbin](https://mobbin.com/discover/apps/web),
[Refero](https://refero.design/), [Godly/Recent](https://recent.design/),
[Lapa Ninja](https://www.lapa.ninja/category/saas/), [Awwwards](https://www.awwwards.com/) and the published
[Linear interface refresh](https://linear.app/now/behind-the-latest-design-refresh). These sources
are inspiration libraries, not templates. OfferLab must not reproduce a specific layout, brand,
illustration or component treatment.

Common patterns worth adopting:

- typography and product content establish hierarchy before colour or decoration;
- navigation and supporting chrome recede after orientation is established;
- warm or softly tinted neutral canvases feel less clinical than pure white and gray;
- one accent colour carries actions, focus and active states;
- structure is communicated with spacing, tonal surfaces and hairline borders;
- shadows are subtle and reserved for genuinely raised surfaces;
- product evidence, realistic examples and direct workflows replace abstract AI imagery;
- compact controls coexist with generous space between page regions;
- mobile layouts preserve the same hierarchy rather than becoming a different product;
- motion is short, purposeful and optional.

Patterns not to adopt:

- copied gallery compositions or recognisable brand treatments;
- generic gradient or glowing-orb AI decoration;
- glass effects that reduce contrast or obscure structure;
- oversized landing-page headings inside ordinary member workflows;
- a separate rounded card around every piece of content;
- multiple competing accents, shadows or radius values;
- animation that delays access to content;
- feature grids that give unavailable and available capabilities equal weight.

## Visual principles

### 1. Calm hierarchy

The member's current task is the strongest element. Navigation, filters, metadata and secondary
actions remain legible but quieter. One page has one primary heading and normally one primary
action.

### 2. Workspace density

Use generous separation between regions and compact spacing within functional groups. Member CRUD
screens must remain efficient and must not resemble marketing landing pages.

### 3. Structure should be felt

Prefer alignment, spacing and small tonal changes. Add a border when it clarifies a boundary. Add a
shadow only when a surface is raised above another surface.

### 4. Evidence over decoration

Public pages demonstrate OfferLab through annotated coaching excerpts, evidence stories, question
workflows and honest availability. Avoid stock illustrations and abstract AI imagery.

### 5. Accessible by default

Text, controls, focus, errors and status distinctions must remain understandable without colour
alone. Native semantics and keyboard operation come before visual novelty.

## Foundations

### Spacing

Use an 8px base grid. The permitted default steps are:

| Token        | Value | Typical use                             |
| ------------ | ----: | --------------------------------------- |
| `--space-1`  |   8px | icon/text gap, compact internal spacing |
| `--space-2`  |  16px | control groups, card gaps               |
| `--space-3`  |  24px | card padding, subsection separation     |
| `--space-4`  |  32px | page heading separation                 |
| `--space-5`  |  40px | major workspace region                  |
| `--space-6`  |  48px | compact marketing section               |
| `--space-8`  |  64px | major marketing section                 |
| `--space-10` |  80px | large desktop marketing rhythm          |

Use 4px only for optical correction, tightly related metadata or the visual gap between repeated
compact rows. A token describes available spacing values; it does not require a full token between
every list item. Repeated filter choices, directory entries and table-like rows may use a 0–4px
visual gap when their row height already provides a clear reading rhythm. Do not introduce arbitrary
values when an adjacent token or an intentional zero-gap row works.

### Typography

- Use the system sans stack for fast loading and native rendering.
- Display headings: weight 700–760, tight tracking, restrained line length.
- Workspace page headings: 32–48px responsive; never marketing scale.
- Body: 16px with approximately 1.6 line height.
- Supporting text: 14px minimum; 12–13px only for short badges or metadata.
- Avoid long uppercase copy. Eyebrows may use restrained tracking.

### Colour

- Canvas: warm near-white, never stark white across the entire viewport.
- Surface: white for content-bearing raised areas.
- Ink: deep green-black rather than pure black.
- Muted ink: must retain WCAG AA contrast on its surface.
- Accent: OfferLab green, reserved for actions, links, focus and selected states.
- Semantic colours: muted red, amber and green with accompanying text or icons.
- Never use colour alone to communicate ready, archived, error or urgency states.
- Standard focus treatment uses the accent colour. Red and amber are reserved for semantic feedback
  and must never be used as the default focus ring because that makes ordinary interaction resemble
  an error.

### Radius and elevation

- Controls: 12px.
- Cards and panels: 16px.
- Large marketing feature panels: up to 20px when the larger scale is justified.
- Pills: full radius only for short statuses, filters and tags.
- Default surfaces use no shadow or the softest shadow token.
- Raised previews and menus may use the medium soft shadow token.

## Components

### Application shell

- Every authenticated member route uses the shared member header and workspace width.
- Brand, primary navigation and account action keep stable positions.
- Active navigation is compact and never fills a large empty container.
- Contextual navigation sits directly above the content it changes.

### Administrator workspace

- Every `/admin` route uses the shared administrator shell, navigation and workspace gutters.
- List pages use the shared admin page width; editors use the narrower shared editor width. Do not
  introduce route-specific outer widths or inherit member-page shells inside the administrator area.
- Multi-column admin controls respond to the available main-content width through container queries,
  because the fixed sidebar and browser zoom change that width independently of the viewport.
- Repeated records use the shared content-row or operation-card patterns. Forms inside those records
  use the shared filter, operation or action layouts so labels, controls and buttons cannot overlap.
- Resource creation and editing use the shared member renderer as a live visual canvas. Editable
  regions select structured fields in an adjacent panel; do not introduce a second approximation of
  the member page or an unstructured whole-page `contenteditable` surface.
- Draft canvases are labelled private. When a published resource is edited, the save action must say
  that it updates members, and browser coverage must prove the member route reads the saved content.
- Add responsive assertions for any new administrator route at 390px and at a constrained desktop
  width before considering its interface complete.

### Buttons

- Primary: solid accent, used for the most important safe action.
- Secondary: neutral surface with a quiet border.
- Tertiary: text link or quiet button for low-emphasis actions.
- Destructive: muted red and visually separated from ordinary save actions.
- Standalone action buttons default to at least 44px. Labels use specific verbs.
- Inline text actions, disclosure controls, filter choices and dense table controls may use a
  28–32px visual row on desktop when focus remains clear and adjacent targets remain distinct. At
  touch breakpoints, provide an approximately 44px hit area without forcing that height into every
  desktop list row.
- Links styled as buttons and native buttons must share height, padding, radius and focus treatment.

### Cards and rows

- Use cards for meaningful grouping, not for every paragraph.
- Prefer compact rows for repeatable records.
- Card titles, descriptions, status and actions follow a stable order.
- Empty states explain what belongs here and offer at most one primary action.

### Forms

- Labels remain visible; placeholders never replace labels.
- Inputs use a 12px radius, 44px minimum height and clear focus ring.
- Help and error text sits next to the affected field.
- Group Save draft, Mark ready and destructive actions by meaning.
- One-page forms remain the default.

### Filters and tabs

- URL-backed filters remain shareable.
- The selected state is visible through text weight and shape or underline, not colour alone.
- Clear filters is available whenever a filter is active.
- Avoid stacked full-width tab bars. Use one primary underline row and a smaller contextual row.

### Status and feedback

- Success and error messages use concise generic language where privacy requires it.
- Status labels use text plus a restrained tint.
- Loading preserves layout where practical and never blocks unrelated navigation.

## Responsive behaviour

- Desktop content width is stable across equivalent member pages.
- At 960px and below, multi-column content reduces without changing task order.
- At 640px and below, page gutters become 16px, primary actions become easy to tap and card padding
  reduces to 20px.
- Navigation may wrap into a deliberate grid; it must not create page-level horizontal overflow.
- Tables and code blocks may scroll within their own region.
- Validate important journeys at 390px and at a representative desktop width.

## Motion

- Use 120–180ms transitions for hover, focus and small state changes.
- Animate opacity, colour and small transforms only.
- Respect `prefers-reduced-motion` and never require animation to understand state.

## shadcn/ui policy

[shadcn/ui](https://ui.shadcn.com/docs) is an open-code component approach, not a reason to add a
second styling architecture. OfferLab should adopt its useful principles: composable local
components, predictable APIs, accessible primitives and ownership of component source.

The current application uses semantic native controls and plain CSS. Do not add Tailwind, Radix or
shadcn dependencies merely to restyle buttons, cards, inputs or tabs that are already accessible.
Use a shadcn/Radix primitive when a new interaction genuinely needs it—such as a dialog, popover,
combobox, dropdown menu or tooltip—and keep its appearance mapped to the tokens in this document.
Do not mix unadapted default shadcn styling with OfferLab styling.

## Implementation checklist

Before considering UI work complete, confirm:

- the page uses the shared shell, width and navigation;
- region and component spacing uses the 8px system; repeated compact rows may use the documented
  0–4px optical gap;
- radii and shadows use shared tokens;
- exactly one primary action is visually dominant in each region;
- button-links and buttons align consistently;
- focus, hover, disabled, error, empty, archived and loading states are covered;
- text and interactive contrast meet WCAG AA;
- keyboard order follows the visual order;
- desktop and 390px layouts have no page-level horizontal overflow;
- reduced motion is respected;
- unavailable capabilities are labelled honestly;
- no private member content is placed in logs, analytics, URLs or decorative examples.
