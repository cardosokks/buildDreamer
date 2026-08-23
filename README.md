# buildDreamer

## Description
A brief description of the buildDreamer project.

## Change History
- c9d482e (2026-08-22) fix(media): resolve image URL resolution and smart image insertion/replacement in editor
- 9403dbb (2026-08-22) feat: RBAC security system (Admin/User), custom login/register, and image bank with dual alternating sidebars in builder
- 7ed6065 (2026-08-22) feat: modal presets, compact lead actions with CRM shortcut, and project CRM links
- ad1f2c6 (2026-08-22) fix(frontend): resolve syntax and build errors in NotificationContext
- 0654cb1 (2026-08-22) feat: compact icon-only action buttons for leads, enhanced list layout and auto-link project to CRM lead on creation
- fd856d2 (2026-08-22) feat: add interactive bell notifications system in Dashboard navbar with persistent storage and trigger events (CRM WON, site generation, project creation/deletion)
- 302e900 (2026-08-22) Fix: encode all AI headers as Base64 to prevent ISO-8859-1 errors ; Refactor: replace sidebar controls in navbar with smart toggle inside sidebar itself
- 2ba6add (2026-08-22) Fix ISO-8859-1 encoding issues in AI headers for Dashboard and projects route
- 30e2120 (2026-08-22) fix: change parallel AI requests to sequential to avoid rate limits
- fa43fe3 (2026-08-22) teste
- c9c59ff (2026-08-22) feat(editor): redesign sidebar toggle buttons with Lucide icons and gradient style
- 5d580d1 (2026-08-22) fix(crm): change tags column type from jsonb to text[] to match DB schema
- ccbcde2 (2026-08-22) fix(crm): robust lead creation with userId validation and full column migration
- 158b3ae (2026-08-22) feat(dashboard): list view, filters, CRM badge, server clock; fix(editor): sidebar toggle buttons
- b35b5dc (2026-08-22) fix(projects): improve AI site creation validation and error handling
- 15c6278 (2026-08-22) fix(crm): fix lead creation and update endpoints with auto-migration and detailed error reporting
- 9c2854a (2026-08-22) fix(editor): improve element click hit-testing, allow precise inner text selection through overlay box and accurately detect editable typography
- da3782c (2026-08-22) refactor(layout): fix dashboard height to screen limit with auto-scrolling sidebar, compact elements and remove redundant page titles
- f9f1633 (2026-08-22) refactor(layout): remove redundant navbar/sidebar toggles from topbar and consolidate collapse controls close to their respective sidebars
- be50288 (2026-08-22) refactor(ui): simplify button labels, notifications and remove technical jargon across editor, settings and crm
