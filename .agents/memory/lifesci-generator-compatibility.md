---
name: LifeSci Nexus generator compatibility
description: Current monorepo codegen constraints for the LifeSci Nexus API contract.
---

OpenAPI integer response fields currently generate `zod.int()` while the workspace resolves Zod 3, so count-like fields use numeric schemas until the generator/runtime pairing changes. Combining path and query parameters for one operation can also create an Orval name collision in the Zod barrel; avoid that shape or verify generated exports before adding filters.

**Why:** The first Phase 1 contract generation failed during the shared-library typecheck even though Orval itself completed successfully.

**How to apply:** After every OpenAPI change, run codegen and the library typecheck before adding server routes or frontend hooks. Prefer the existing generated output over guessing names.