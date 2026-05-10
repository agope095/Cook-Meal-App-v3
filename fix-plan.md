# Phase 1: Code-Driven UI/UX Audit & Fix Plan

Based on the static analysis of the codebase, here are the identified mobile UI/UX issues, categorised by their severity.

| Component / File Path | Issue Category | Code-Level Observation | Proposed Fix | Severity |
| :--- | :--- | :--- | :--- | :--- |
| `src/OwnerApp.tsx` | Mobile-First Additions | The bottom navigation bar uses `fixed bottom-6` which might intersect with the iOS Home Indicator or Android gesture navigation. | Add `pb-safe` (safe area padding) to the bottom navigation and body container. Adjust `bottom-6` to account for safe area insets. | High |
| `src/components/OwnerDashboard.tsx` | UI Check (Overflow/Responsiveness) | The sticky header uses `flex flex-col md:flex-row` but some internal clusters have fixed spacing or lacking wrap behavior, potentially causing horizontal overflow on very narrow screens (e.g. iPhone SE). | Add `flex-wrap` to action button clusters and ensure container paddings allow wrapping. | Medium |
| `src/components/OwnerDashboard.tsx` | UI Check (Modals) | Modals (Nutrition Atelier, Grocery List) use `fixed inset-0 p-4` and inner content `max-h-[90vh]`. On small mobile screens, large modals can overflow or be difficult to close if the X button is hidden by the notch. | Implement safe area top padding (`pt-safe`) for fixed modals, and ensure the close button (`X`) is within the safe area. | High |
| `src/components/ChatAssistant.tsx` | UX Friction | Mobile view sets `fixed bottom-0 right-0 left-0 top-0` for full screen, but doesn't respect safe areas (notch/home indicator), meaning headers/input could be cut off. | Add `pt-safe` and `pb-safe` padding to the fullscreen chat window container. | High |
| `src/components/AIMealPlanner.tsx` | UI Check (Responsiveness) | The main layout uses `p-8 md:p-12`. On mobile, `p-8` takes up a lot of valuable horizontal space (2rem on each side). | Reduce mobile padding to `p-4` or `p-5` to maximize content width on small screens. | Medium |
| `src/components/OwnerProfile.tsx` | UX Friction (Form Inputs) | Long text inputs and stacked grid layouts for forms (`grid-cols-1 md:grid-cols-2`) can feel tedious. The "Meals to Plan" uses `grid-cols-2 sm:grid-cols-4`, which is good, but `p-4` padding makes the touch targets large. | Ensure touch targets are at least 44x44px. Optimize form spacing for single-column mobile view to reduce vertical scrolling. | Low |
| `src/components/WeeklyView.tsx` | UI Check (Responsiveness) | `flex-row` used for day cells (`lunch` / `dinner`), which can become cramped if items have long names. | Stack meal cells vertically on mobile (`flex-col`) and horizontally on desktop (`md:flex-row`). | Medium |

### Fix Plan

1.  **Fix Safe Areas in App Shell (`src/OwnerApp.tsx`):**
    *   Update the `fixed bottom-6` navigation to use CSS environment variables (`env(safe-area-inset-bottom)`) to prevent overlapping with system UI.
2.  **Fix Fullscreen Chat Safe Areas (`src/components/ChatAssistant.tsx`):**
    *   Add `pt-[env(safe-area-inset-top)]` and `pb-[env(safe-area-inset-bottom)]` to the fullscreen mobile chat window so the header and input aren't clipped by the notch or home indicator.
3.  **Optimize Modal Safe Areas & Sizing (`src/components/OwnerDashboard.tsx`):**
    *   Ensure the Nutrition Atelier and Grocery Draft modals respect top and bottom safe areas so the close buttons are always reachable.
4.  **Improve Responsive Padding (`src/components/AIMealPlanner.tsx`):**
    *   Change `p-8` to `p-4 md:p-8` on the main container cards to reclaim horizontal screen real estate on mobile devices.
5.  **Refine Weekly View Layout (`src/components/WeeklyView.tsx`):**
    *   Update the internal flex container for meals to stack vertically on mobile to prevent horizontal squishing of long meal names.

🛑 STOP AFTER PHASE 1.
