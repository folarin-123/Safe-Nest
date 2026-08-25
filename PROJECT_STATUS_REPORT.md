# SafeNest Backend — Project Status Report

## 1. Executive Summary
SafeNest is a NestJS + Prisma + PostgreSQL financial planning backend designed to help users set savings goals, calculate contribution schedules, track deposits, receive automated reminders, and analyze goal health. Based on a comprehensive audit of all controllers, services, DTOs, and Prisma schemas, the backend core features (authentication, financial profiling, goal management, goal health engine, recovery planning, and manual contributions) are fully implemented and functional. External integrations (SendGrid email delivery, Cloudinary profile photo storage, and Monnify checkout payments) are complete in code but require valid live credentials and environment variables to function in production environments.

---

## 2. Feature-by-Feature Functional Audit

| Feature | Status | Evidence | Notes |
| :--- | :--- | :--- | :--- |
| **Auth: Register & Login** | ✅ Fully working | `src/modules/auth/auth.controller.ts`<br>`src/modules/auth/auth.service.ts` | Email and phone uniqueness checked. Password hashed via bcrypt (salt 10). Generates JWT access token. |
| **Auth: Password Reset** | ✅ Fully working | `src/modules/auth/auth.controller.ts`<br>`src/modules/auth/auth.service.ts` | Uses cryptographically secure random token, stores SHA256 token hash in `PasswordReset` table with 15-minute expiry. Sends template email via SendGrid. |
| **Auth: Change Password** | ✅ Fully working | `src/modules/auth/auth.controller.ts`<br>`src/modules/auth/auth.service.ts` | Authenticated endpoint. Validates old password and verifies new password differs before updating. |
| **Auth: Two-Factor Authentication (2FA)** | ✅ Fully working | `src/modules/auth/auth.controller.ts`<br>`src/modules/auth/auth.service.ts` | TOTP secret generated via `otplib`, QR code via `qrcode`. Requires challenge token verification (`POST /auth/2fa/verify-login`) when `mfaEnabled` is true. |
| **Auth: OAuth Login** | ✅ Fully working | `src/modules/auth/oauth.controller.ts`<br>`src/modules/auth/strategies/` | Passport strategies for Google and Facebook OAuth callback handling. Links account by email or creates new user. |
| **User Profile & Settings** | ✅ Fully working | `src/modules/users/users.controller.ts`<br>`src/modules/users/users.service.ts` | Profile retrieval/update, notification preferences upsert (`UserSettings`). |
| **Avatar Upload / Removal** | 🔌 Requires external service | `src/modules/users/users.controller.ts`<br>`src/modules/users/users.service.ts` | Multer file interceptor with 5MB limit and image mimetype check. Destroys prior Cloudinary assets and streams to `safenest/avatars/`. Requires `CLOUDINARY_*` keys. |
| **Delete Account** | ✅ Fully working | `src/modules/users/users.controller.ts`<br>`src/modules/users/users.service.ts` | Soft deactivates user (`status: DEACTIVATED`), clears phone, prefixes email to allow reuse. `JwtStrategy` automatically rejects deactivated users. |
| **Financial Profile** | ✅ Fully working | `src/modules/financial-profile/financial-profile.controller.ts` | Manages income amount, frequency, fixed/variable expenses, existing savings, and commitments. |
| **Goals CRUD** | ✅ Fully working | `src/modules/goals/goals.controller.ts`<br>`src/modules/goals/goals.service.ts` | Supports goal creation, list, detail (with contribution history), and update. Automatically recalculates required contribution and health score on creation/update. |
| **Goal Calculation Engine** | ✅ Fully working | `src/modules/goals/goals.utils.ts`<br>`src/modules/goals/goal-calculation.service.ts` | Calculates required contribution per frequency period, progress %, goal health score (0-100), health status (`HEALTHY`, `AT_RISK`, `OFF_TRACK`, `ACHIEVED`), and feasibility assessment. |
| **Smart Recovery Plan** | ✅ Fully working | `src/modules/goals/goal-calculation.service.ts` | Analyzes behind-schedule goals and proposes 3 options: increase contribution, extend deadline, or reduce target amount. |
| **Goal Simulator** | ✅ Fully working | `src/modules/goals/goal-calculation.service.ts` | Pure calculation endpoint allowing scenario testing with modified target, deadline, or contribution frequency without persisting changes. |
| **Contributions Tracking** | ✅ Fully working | `src/modules/contributions/contributions.controller.ts`<br>`src/modules/contributions/contributions.service.ts` | Atomic database transactions using serializable isolation level. Idempotency enforced by unique `externalReference`. Updates goal `currentAmount`, health score, and status atomically. |
| **Bank Accounts / Mono** | ❌ Replaced / Removed | `src/prisma/schema.prisma` | Mono bank account linking was completely uninstalled and replaced with Monnify checkout payment flow per architectural decision. |
| **Payments / Monnify** | 🔌 Requires external service | `src/modules/payments/monnify-client.service.ts`<br>`src/modules/payments/payments.service.ts` | Monnify checkout initiation (`POST /payments/initiate`), transaction status verification (`POST /payments/verify`), and webhook handler (`POST /payments/webhook`). Supports mock mode (`MOCK_MONNIFY=true`) for sandbox/demo testing without live API keys. |
| **Notifications & Reminders** | ✅ Fully working | `src/modules/notifications/notifications.controller.ts`<br>`src/modules/notifications/reminders.service.ts` | In-app notification log querying/read marking. Scheduled daily cron (`@Cron`) evaluates active goals and dispatches reminders respecting weekly cadence and user settings. Email sending uses SendGrid templates. |
| **Analytics & Dashboard** | ✅ Fully working | `src/modules/analytics/analytics.controller.ts`<br>`src/modules/analytics/dashboard.controller.ts` | Logs analytics events. Dashboard aggregates total target savings, total current savings, overall progress %, active goals count, health breakdown, and recent activity. |

---

## 3. End-to-End User Journey

1. **Registration & Initial Access**:
   A user registers via `POST /api/v1/auth/register` with `fullName`, `email`, `phone`, `password`, and `confirmPassword`. They immediately receive a JWT `accessToken` and user object. Email verification is stored in the database (`isVerified: true` by default), but no verification gate blocks route access.

2. **Setting Up Financial Profile**:
   The user configures their monthly financial profile via `PUT /api/v1/financial-profile` supplying `incomeAmount`, `incomeFrequency`, `fixedExpenses`, `variableExpenses`, and `existingSavings`.

3. **Goal Creation & Engine Calculation**:
   The user creates a goal via `POST /api/v1/goals` providing `goalName`, `category`, `targetAmount`, `deadline`, and `contributionFrequency`. The engine immediately calculates the `requiredContribution` per period, progress percentage, initial goal health score (0-100), and status (`HEALTHY` / `AT_RISK` / `OFF_TRACK`), returning the computed plan.

4. **Making Contributions & Progress Update**:
   The user logs a contribution either manually via `POST /api/v1/contributions` or through Monnify payment checkout (`POST /api/v1/payments/initiate` -> redirect -> `POST /api/v1/payments/verify`). An atomic database transaction increments the goal's `currentAmount`, recalculates the new health score and required contribution, and marks the goal as `ACHIEVED` if `currentAmount >= targetAmount`.

5. **Monitoring Dashboard & Recovery Planning**:
   The user checks `GET /api/v1/dashboard` for an aggregate view of total savings and goal health breakdown. If a goal falls behind, the user requests a recovery plan via `GET /api/v1/goals/calculation/recovery-plan/:goalId`, receiving three distinct options (higher contribution, extended deadline, or reduced target). They can also test hypothetical scenarios using `POST /api/v1/goals/calculation/simulate`.

6. **Automated Reminders & Account Security**:
   Daily cron jobs evaluate users with active goals. If reminders are enabled and none was sent in the last 7 days, an in-app `NotificationLog` entry and SendGrid email are generated. The user can enable 2FA via `POST /api/v1/auth/2fa/setup` and `POST /api/v1/auth/2fa/enable`, requiring 2FA challenge verification on subsequent logins.

7. **Account Deactivation**:
   The user deactivates their account via `DELETE /api/v1/users/me`, supplying their password. Status transitions to `DEACTIVATED`, their email is prefixed with `deleted_{id}_`, and subsequent JWT validation attempts are rejected automatically by `JwtStrategy`.

---

## 4. Complete API Reference

### Auth Module
| Method | Path | Auth Required? | Request Body Fields | Response Shape |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | No | `fullName`, `email`, `phone`, `password`, `confirmPassword` | `{ user, accessToken }` |
| `POST` | `/api/v1/auth/login` | No | `email`, `password` | `{ user, accessToken }` OR `{ mfaRequired: true, challengeToken }` |
| `GET` | `/api/v1/auth/me` | Yes | None | User profile object |
| `POST` | `/api/v1/auth/forgot-password` | No | `email` | `{ message }` |
| `POST` | `/api/v1/auth/reset-password/:token` | No | `newPassword`, `confirmPassword` | `{ message }` |
| `PUT` | `/api/v1/auth/change-password` | Yes | `oldPassword`, `newPassword`, `confirmPassword` | `{ message }` |
| `POST` | `/api/v1/auth/2fa/setup` | Yes | None | `{ qrCodeDataUrl, manualEntryKey }` |
| `POST` | `/api/v1/auth/2fa/enable` | Yes | `code` | `{ message }` |
| `POST` | `/api/v1/auth/2fa/disable` | Yes | `password` | `{ message }` |
| `POST` | `/api/v1/auth/2fa/verify-login` | No | `challengeToken`, `code` | `{ user, accessToken }` |

### Users Module
| Method | Path | Auth Required? | Request Body Fields | Response Shape |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users/health` | No | None | `{ status }` |
| `GET` | `/api/v1/users/me` | Yes | None | Safe user object |
| `PUT` | `/api/v1/users/me` | Yes | `fullName?`, `phone?` | Updated safe user object |
| `GET` | `/api/v1/users/me/settings` | Yes | None | User settings object |
| `PUT` | `/api/v1/users/me/settings` | Yes | `pushEnabled?`, `emailEnabled?` | Updated user settings object |
| `POST` | `/api/v1/users/me/avatar` | Yes | `file` (multipart/form-data) | Updated safe user object with `avatarUrl` |
| `DELETE` | `/api/v1/users/me/avatar` | Yes | None | Updated safe user object |
| `DELETE` | `/api/v1/users/me` | Yes | `password?` | `{ message }` |

### Financial Profile Module
| Method | Path | Auth Required? | Request Body Fields | Response Shape |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/financial-profile` | Yes | None | Financial profile object |
| `PUT` | `/api/v1/financial-profile` | Yes | `incomeAmount?`, `incomeFrequency?`, `fixedExpenses?`, `variableExpenses?`, `existingSavings?`, `existingCommitments?` | Updated financial profile object |

### Goals Module
| Method | Path | Auth Required? | Request Body Fields | Response Shape |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/goals` | Yes | `goalName`, `category?`, `targetAmount`, `deadline`, `contributionFrequency`, `preferredContribution?`, `description?`, `priority?` | Computed goal plan object |
| `GET` | `/api/v1/goals` | Yes | None | Array of goal objects |
| `GET` | `/api/v1/goals/:id` | Yes | None | Goal detail object with `contributions` history |
| `PUT` | `/api/v1/goals/:id` | Yes | `goalName?`, `category?`, `targetAmount?`, `deadline?`, `contributionFrequency?`, `preferredContribution?`, `description?`, `priority?` | Updated computed goal object |
| `POST` | `/api/v1/goals/calculation/simulate` | Yes | `targetAmount`, `deadline`, `contributionFrequency`, `currentAmount?`, `preferredContribution?` | Simulated plan & health score object |
| `GET` | `/api/v1/goals/calculation/recovery-plan/:goalId` | Yes | None | `{ goalId, currentStatus, recoveryOptions }` |

### Contributions Module
| Method | Path | Auth Required? | Request Body Fields | Response Shape |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/contributions` | Yes | `goalId`, `amount`, `contributionDate`, `trackingType`, `externalReference?` | `{ contribution, goal, goalAchieved }` |
| `GET` | `/api/v1/contributions/goal/:goalId` | Yes | Query: `page?`, `limit?` | Paginated contributions list with metadata |

### Payments Module
| Method | Path | Auth Required? | Request Body Fields | Response Shape |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/payments/initiate` | Yes | `goalId`, `amount?` | `{ checkoutUrl, transactionReference, goalId }` |
| `POST` | `/api/v1/payments/verify` | Yes | `transactionReference`, `goalId` | `{ success, verificationDetails, contribution, goal, goalAchieved }` |
| `POST` | `/api/v1/payments/demo` | Yes | `goalId`, `amount?` | `{ success, verificationDetails, contribution, goal, goalAchieved }` |
| `POST` | `/api/v1/payments/webhook` | No | Webhook payload | `{ received: true }` |

### Notifications Module
| Method | Path | Auth Required? | Request Body Fields | Response Shape |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | Yes | Query: `page?`, `limit?`, `type?`, `unreadOnly?` | Paginated notifications array |
| `GET` | `/api/v1/notifications/unread-count` | Yes | None | `{ unreadCount }` |
| `PATCH` | `/api/v1/notifications/:id/read` | Yes | None | Updated notification log object |
| `PATCH` | `/api/v1/notifications/read-all` | Yes | None | `{ updatedCount }` |
| `POST` | `/api/v1/notifications/trigger-reminders` | Yes | None | `{ usersEvaluated, remindersSent }` |

### Analytics & Dashboard Module
| Method | Path | Auth Required? | Request Body Fields | Response Shape |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/analytics/track` | Yes | `eventName`, `properties?` | `{ tracked: true }` |
| `GET` | `/api/v1/dashboard` | Yes | None | Dashboard aggregate stats & health breakdown |

---

## 5. Known Gaps & Recommendations

1. **Email Verification Enforcement**:
   - `User.isVerified` defaults to `true` on creation and is not checked in `JwtStrategy` or route guards. If mandatory email verification is desired prior to application usage, an activation step must be introduced.

2. **External Webhook Security Verification**:
   - Monnify webhooks (`POST /payments/webhook`) currently rely on transaction verification callbacks rather than HMAC signature validation headers. Implementing Monnify transaction hash header validation will improve production webhook security.

3. **External Integration Live Keys**:
   - SendGrid, Cloudinary, and Monnify require live production credentials in `.env` to execute real external network requests. Mock mode (`MOCK_MONNIFY=true`) is available for offline testing.

---

## 6. Test Coverage Summary

| Test File | Target Subject / Assertions | Major Gaps |
| :--- | :--- | :--- |
| `test/goal-utils.test.ts` | Verifies `calculateRequiredContribution`, `buildGoalPlan` status transitions (`ACTIVE`, `ACHIEVED`, `OFF_TRACK`), `calculateGoalHealthScore`, `assessFeasibility`, and frequency normalization. | Covered |
| `test/payments.test.ts` | Verifies `MonnifyClientService` checkout initiation, mock verification, and dynamic reference amount parsing. | Covered |

*Note: E2E HTTP integration tests across controller endpoints are currently driven manually or via Postman/Playwright scripts. Adding automated integration tests for `AuthService` and `ContributionsService` is recommended.*
