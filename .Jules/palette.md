## 2025-05-09 - Missing ARIA Labels on Icon Buttons
**Learning:** Many interactive buttons in the application only have icons (like `Trash2`, `Plus`, `X`, `ChevronLeft`, `ChevronRight`) without any text or `aria-label`, making them completely inaccessible to screen readers. For example, the `Trash2` buttons for deleting a cook/invite or family member rely purely on visual context.

**Action:** Add `aria-label` or `title` attributes to all icon-only buttons to ensure they convey their purpose to assistive technologies. I'll pick one file like `ManageFamily.tsx` to add these labels, as well as disable states/loading indicators where relevant.
