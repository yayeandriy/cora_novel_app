# Angular Control Flow Migration (ngIf/ngFor/ngSwitch → @if/@for/@switch)

Date: 2025-11-03

We migrated all templates to Angular's modern control flow syntax as per https://angular.dev/overview.

What changed:
- Replaced `*ngIf` with `@if {}` (and `@else {}` where applicable)
- Replaced `*ngFor` with `@for (...) {}` using `track` expressions (prefer `track item.id`)
- Replaced `ng-template`-based else blocks with `@else`
- Replaced `[ngSwitch]`/`*ngSwitchCase`/`*ngSwitchDefault` with `@switch`/`@case`/`@default` (none present in codebase)

Notes:
- Component tags previously wrapped with structural directives (`*ngIf`, `*ngFor`) are now wrapped with `@if`/`@for` blocks because new control flow cannot be applied as attributes.
- Where legacy `trackBy` functions were used, we now rely on stable identifiers via `track item.id` for performance and clarity.
- No behavioral changes intended.

Verification:
- Built project with Angular 20.1.4: PASS
- Ran quick search to confirm no remaining `*ngIf`, `*ngFor`, `ng-template`, `ngSwitch` constructs in `src/**/*.html`.

If you add new templates, prefer the new control flow syntax. See Angular docs for details and advanced patterns (`@empty`, `@defer`).
