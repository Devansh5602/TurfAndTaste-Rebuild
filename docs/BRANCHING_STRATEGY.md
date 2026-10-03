# Branching strategy

```text
main
  production-ready state
    └── develop
          integration branch
            ├── feature/*   product features
            ├── fix/*       defect corrections
            ├── chore/*     architecture, tooling, infrastructure
            └── hotfix/*    urgent production fixes
```

## Rules

- Do not do ongoing development directly on `main`.
- Branch feature, fix, and chore work from `develop`.
- Branch `hotfix/*` from `main` when a production fix cannot wait for the integration branch.
- Open pull requests into `develop`, except hotfixes, which target `main` and are merged back into `develop`.
- Do not merge into `main` without an explicit request.
- Do not force-push unless explicitly authorized.
- Keep commits conventional: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`.
- Reference GitLab or GitHub issues in commit and merge-request text when an issue exists.

## Phase 0

Foundation work lives on `chore/foundation-bootstrap`, branched from `develop`. It is not merged automatically.
