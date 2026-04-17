// User stub — re-exports the real User from accounts module (Sprint 3+).
//
// The alias `UserStub` is maintained for backward compatibility with
// articles/models/index.ts and articles.routes.spec.ts.
// No functional change: UserStub === User from accounts/models/user.model.ts.
//
// Sprint 3 change: accounts/models/user.model.ts is now the single source of
// truth for the accounts_user table. This file is kept to avoid renaming
// all references in the articles module.

export { User as UserStub } from '../../accounts/models/user.model';
