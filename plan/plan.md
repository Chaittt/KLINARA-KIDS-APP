# Klinara Kids — Going Live: UPI Payments & Notifications

An upgrade of the existing Klinara Kids preschool app that turns the currently
"demo/mocked" payment and notification areas into real, production-ready features.

**Important: no redesign.** Existing design, navigation, screens, roles, colors,
layouts, and UX stay unchanged. Only the minimum touchpoints for the new
functionality are added. Focus is on the Parent and Admin/MD experience first.

## Where the app is today (from reviewing the code)

All four roles already work: Parent, Teacher, Admin, MD — covering child dashboard,
daily activities, attendance, fees, schedule, homework, announcements, complaints,
the Elthea GROW profile, staff attendance, reports, salaries, fee structure, and
curriculum. A manual UPI-submit + admin-verify payment flow and a UPI-settings
store already exist and will be reused/enhanced rather than rebuilt.

Two areas need upgrading:
- **Payments** — currently a mock/demo flow; make the manual UPI + verification flow
  the real, complete path.
- **Notifications & login management** — remove on-screen "debug" OTP/reset values,
  give MD proper account management, and add real push notifications.

## Who it's for
- **Parents** — primary daily users.
- **Admin / MD** — manage fees, payments, users, and communication.
- **Teachers** — keep using existing attendance, activity, and homework features.

## Core features and experience

### 1. Real fee payments using UPI (not Razorpay this phase)

**MD UPI configuration**
- MD can add/update the school's UPI ID (e.g. `klinara@upi`) at any time.
- The currently active UPI ID is shown to parents at payment time.
- Stored securely in the backend; only MD/Admin can manage it.

**Parent payment flow**
Fees → select unpaid fee → app shows the fee amount → Pay Now → active UPI ID is
displayed → parent pays in their own UPI app → Payment Done → parent enters the UPI
transaction/reference ID → submit → status becomes **Pending Verification** →
Admin verifies → fee becomes **Paid** → parent sees updated status/receipt.

**Fee amount security**
- Amount always comes from the backend fee record; parent cannot edit it.
- Parent cannot mark a fee Paid; only backend/admin verification can.

**Admin payment verification**
For each submitted payment, Admin sees: student name, parent name, fee month/period,
expected amount, UPI reference ID, submission date/time, status, and payment
proof/screenshot if the existing flow supports it. Admin can:
- **Verify/Accept** → Pending Verification → Paid.
- **Reject** → Pending Verification → Rejected; parent sees the rejected status and
  can resubmit payment details.
- Verification records who verified and when.

**MD/Admin reporting**
Existing revenue/reporting keeps working, driven by verified payments only. Views
include total fees, paid, pending, awaiting verification, rejected, outstanding, and
total verified collections. Only verified payments count as completed revenue.

### 2. Notifications & login management

**Remove debug/secret exposure**
- Remove on-screen debug OTP, password-reset tokens, and any auth/debug info shown
  to users. Credentials handled securely.

**MD user/login management** (in the existing Admin/MD management area)
- MD can view login identifiers and manage accounts for Parents, Teachers, Admins,
  and MD: create/manage accounts, activate/deactivate, reset credentials, and
  generate/reset temporary credentials where required.
- **Security:** never store or display plaintext passwords; existing passwords stay
  non-recoverable (hashed). Password changes use a secure reset/change mechanism.

### 3. Push notifications
- **Parents**: new announcement, new daily activity for their child, fee reminder,
  payment submitted, payment verified/accepted, payment rejected.
- **Admin**: new payment submitted and awaiting verification; other key ops alerts.
- **MD**: important payment/collection and administrative alerts.

### 4. Fee reminder (manual)
- Admin has a "Send Fee Reminder" option in the existing fee-management interface;
  the parent receives a push that the fee is due/pending.
- No automatic/scheduled reminders in this phase.

### 5. Notification navigation
Tapping a notification opens the relevant **existing** screen (announcement →
Announcements, activity → Activity, fee/payment → Fees/Receipt). No duplicate
screens are created.

### 6. Parent login
Keep the existing parent login. The current fixed/demo OTP can remain temporarily,
but the OTP is never shown as a debug value and no auth secrets appear in the UI.
Architecture stays ready for real SMS OTP later.

## User flow — Fees
Parent: Fees → Pay Now → view UPI ID → pay in UPI app → Payment Done → enter UPI
reference → submit → **Pending Verification**.
Admin: review → Verify or Reject. If verified → **Paid**, parent sees receipt. If
rejected → **Rejected**, parent can review and resubmit.

## UI/UX feel — no redesign
Do **not** redesign, change navigation, colors, typography, dashboard layouts, cards,
role structure; do not remove functionality or create duplicate screens. **Do** reuse
existing components, screens, and design language; keep the same spacing, buttons,
cards, and layouts; add only the minimum controls for the new functionality so it
feels native to the existing Klinara Kids app.

## Implementation phases

### Phase 1 — Built now
- Payments: MD configures active UPI ID; parent sees it and submits UPI payment with
  a reference ID; status goes Pending Verification; Admin verifies or rejects;
  verified becomes Paid; parent sees updated status/receipt; Admin/MD reporting uses
  verified payment data; verification records who and when.
- Notifications: remove debug OTP/reset values; secure login/account management; MD
  manages Parent/Teacher/Admin/MD accounts; push notifications for announcements,
  daily activities, fee reminders, payment submitted/verified/rejected; Admin can
  manually send fee reminders; notification taps open the right existing screen.

### Phase 2 — Later
Two-way Parent ↔ Teacher messaging; automated scheduled fee reminders; sibling
discount logic; richer media (multi-photo galleries, short video clips); enhanced
payment options if required.

### Phase 3 — Later
Online enrollment/admissions; analytics dashboards (retention, attendance trends,
collection rate); real SMS OTP for parent login; additional payment gateway if needed.

## Assumptions
- Payment method = UPI ID (not Razorpay) this phase; MD controls the active UPI ID.
- Parents pay in their own UPI app and submit the UPI reference ID; Admin manually
  verifies before a fee becomes Paid.
- Parent cannot edit the amount or mark a fee Paid. Existing manual verification is
  reused/enhanced.
- Parent login keeps the current demo OTP temporarily; debug/auth values are never
  shown; real SMS OTP is a future phase.
- Fee reminders are manual (Admin-triggered) in Phase 1; no scheduled reminders.
- No changes to photo/media storage this phase; existing media implementation
  untouched.
- No changes to existing screens' look, roles, or navigation — this is an upgrade of
  payment and notification functionality, not a redesign.

## Note on push notifications (platform requirement)
Push uses Emergent's managed push service. Two things are required for it to work on
real devices:
1. You provide one Firebase **google-services.json** file (for Android delivery).
2. Push works only after you **Publish → deploy → generate an iOS/Android build** —
   it cannot be tested in the Expo Go preview. All in-app logic will be built and
   ready so it works as soon as the build is generated.
