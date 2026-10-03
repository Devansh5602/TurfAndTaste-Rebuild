# Agent instructions

This repository is the Turf & Taste rebuild. It does not continue an older codebase. Do not copy code from a previous Turf & Taste project unless a person explicitly provides that file and authorizes it.

Before substantial work:

1. Read `docs/PRODUCT_TRUTH.md`.
2. Read `docs/ARCHITECTURE.md`.
3. Read `docs/UI_KIT.md`.
4. Read `docs/AI_HANDOFF.md`.

Then follow these rules:

1. Do not invent product requirements.
2. Do not introduce sports that `docs/PRODUCT_TRUTH.md` does not list.
3. Do not turn dining into food ordering, carts, checkout, delivery, or food payment.
4. Do not hardcode a fake customer identity.
5. Do not present fixture data as production data. Label fixtures as fixtures.
6. Do not expose secrets, service-role keys, or payment secrets in code, logs, docs, or commits.
7. Use a maintained package before writing a custom version of a solved problem. Read `docs/PACKAGE_POLICY.md`.
8. Use design tokens. Do not sprinkle new hex colors through screens.
9. Keep Clubhouse Ivory and Midnight Ivory working.
10. Keep theme state global. It must survive navigation, remounts, and restarts.
11. Add tests for meaningful behavior.
12. Run tests before commits.
13. Run typecheck and the relevant build before finishing a phase.
14. Make logical conventional commits.
15. Update `docs/AI_HANDOFF.md` after substantial work.
16. Do not force-push unless explicitly authorized.
17. Do not deploy production unless explicitly authorized.
18. Do not change product truth silently. Record a decision in `docs/DECISIONS.md` when an architectural choice changes.
19. Keep booking time, availability, eligibility, pricing, and payment verification on the server.
20. Do not trust a client total or a client payment-success flag.
21. Leave the working tree clean at handoff.
22. Do not merge into `main` unless explicitly asked. Branching rules are in `docs/BRANCHING_STRATEGY.md`.

`.cursor/rules/project.mdc` and `CLAUDE.md` only point here. Do not create a competing instruction set.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
