---
title: Styles
---

All frontend implementations should use the shared [styles.css](https://github.com/realworld-apps/realworld/blob/main/assets/theme/styles.css) file from the main repository. This is a self-contained CSS file (Conduit Minimal CSS v4) that includes only the classes actually used by Conduit.

The CSS classes it provides match the [templates](/specifications/frontend/templates) and the [E2E test selectors contract](https://github.com/realworld-apps/realworld/blob/main/specs/e2e/SELECTORS.md).

### Default Avatar

When a user has no profile image, implementations should display the [default avatar](https://github.com/realworld-apps/realworld/blob/main/assets/media/default-avatar.svg) (a smiley face icon).
