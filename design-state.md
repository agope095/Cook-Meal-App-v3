# Design State: Actionable Nutrition & Affordance

## Project Brief Summary
- **Problem:** Low affordance for inputs, vague nutritional feedback, and manual math for meal totals.
- **Primary Persona:** Health-conscious home cooks.
- **Success Metric:** Users can see total meal macros instantly and find inputs intuitively.

## Design Principles
- **Clarity over Cleverness:** Show hard numbers (Calories) instead of vague descriptors.
- **Zero Latency:** All meal summaries must be calculated locally, no AI calls.
- **Elegant Affordance:** Interactive areas must be obvious but stay "Clean Luxury."

## Decisions Log
| ID | Decision | Rationale |
|----|----------|-----------|
| D01 | Approach A (Dashboard Summary) | Provides immediate value without extra user effort. |
| D02 | Local Math for Balance | Avoids cost and latency of extra AI calls. |

## Open Questions
- What specific macro ratios define a "Balanced" vs "Protein-Rich" meal in our logic? (RESOLVED: 35% Protein / 60% Carbs thresholds implemented)

## Design Debt Register
| ID | Finding | Status | Resolution |
|----|---------|--------|------------|
| DEBT-01 | Icon semantic mismatch | RESOLVED | Icons removed for a cleaner editorial look. |
| DEBT-02 | No empty state | RESOLVED | Added warm editorial empty state card. |
| DEBT-03 | No RDA baseline context | RESOLVED | Added "of ~2,000 kcal target" label. |
| DEBT-04 | Balance score logic labels | RESOLVED | Refined to "Balanced Fuel", "Protein Focused", etc. |

## Artefact Index
- **Design Brief:** [2026-05-08-actionable-nutrition.md](docs/designpowers/briefs/2026-05-08-actionable-nutrition.md)
- **Critique Report:** [critique_nutrition_widget.md.resolved](.gemini/antigravity/brain/4bb2d69e-82b3-4280-b8f3-92f1b02d9b19/critique_nutrition_widget.md.resolved)
- **Design Plan:** [2026-05-09-nutrition-refinement-plan.md.resolved](.gemini/antigravity/brain/4bb2d69e-82b3-4280-b8f3-92f1b02d9b19/2026-05-09-nutrition-refinement-plan.md.resolved)

## Handoff Chain
- **design-lead → design-strategist:** Initialized state and brief.
- **design-critic → design-builder:** Performed critique and oversaw refinement fix round.
- **design-builder → engineering:** Refinement complete. Visual and functional verification passed.
