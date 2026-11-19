# Bstudio Design Directive

## Product intent

Bstudio is a professional internal application for VFX and creative production. Review designs from product design, UX architecture, design systems, and frontend engineering perspectives. Optimize daily work in production, team management, attendance, KPI, payroll, finance, approvals, notes, and reporting. Apply the approved role and data boundaries to every workflow.

## Visual identity

Use graphite, charcoal, off-white, and controlled Bstudio red. The product should feel precise, confident, technical, understated, and premium. Prioritize typography, alignment, rhythm, information density, and meaningful contrast. Centralize design tokens for semantic color, typography, spacing, borders, and interaction states.

Avoid generic gradients, excessive rounded or floating cards, glass effects, glow, unnecessary shadows, oversized headings, wasteful whitespace, decorative metrics, generic illustrations, and emoji interface icons. Show dashboard numbers where they help a user make a decision. Use status text alongside semantic color. Design tables, forms, filters, and navigation as primary components.

## UX and implementation

Design loading, empty, error, validation, and success states. Support small screens and keyboard navigation, including visible focus and understandable error recovery. Use WCAG 2.2 AA as the accessibility target and document coverage from actual checks. Keep reusable components composable, maintain clear boundaries, and use consistent breakpoints. Avoid unnecessary dependencies and consider loading performance, error handling, and maintainability.

## Workflow and review

1. Analyze requirements and real workflows by role.
2. Propose three distinct visual directions with rationale. Record the selected direction.
3. Define the complete design system, including states and responsive behavior.
4. Design representative high-fidelity screens. Obtain approval for implementation.
5. Implement the approved design in reusable components.
6. Run visual, functional, responsive, and accessibility QA.

After each major implementation, review the result from a senior product designer's perspective. Remove generic or decorative patterns. Verify density, spacing, typography, alignment, contrast, focus, and consistency. Test representative workflows and edge cases, fix findings, and repeat the affected checks. Report verified coverage and open gaps before describing the interface as production-ready.

## First evaluation workflows

- Admin production: find a particular shot among 100 or more, read Notes, identify the latest preview, give feedback, and record QC.
- Employee on mobile: clock in or out, find an assigned task, submit a preview, and inspect own KPI and slip.
- Owner and payroll: distinguish cash from outstanding invoices, inspect Notes, change a KPI for a later period, and verify the calculation preview.
- Viewer: open only the assigned projects and authorized tracker data.
