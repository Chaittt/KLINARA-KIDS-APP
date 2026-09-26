# Klinara Kids — Student Fee Plans at Registration

Add fee configuration to student registration so each child has a defined fee that
turns into the payments parents actually see and pay. Admin/MD choose a one-time or
a 3-installment "term" plan when adding (or updating) a student.

## Who it's for
- **Admin / MD** — set up each student's fee and plan at registration.
- **Parents** — see the resulting fee(s) and pay them through the existing UPI flow.

## What changes in "Add Student"

Today the Add Student form captures: Student name, Class, Parent phone, Age (optional).
It will now also capture:

- **Parent name** (new, required) — used as the parent's real account name instead of
  the current auto-generated "Parent of <child>". Where a parent + child are shown
  together, they read as `Parent name — Child: Child name`.
- **Total fees** (new, required) — whole rupees (e.g. 30000), no decimals.
- **Plan type** (new, required) — one of:
  - **Single (one-time)** — the parent owes the full total in a single payment.
  - **Term (3 installments)** — the fee is split across 3 installments.

When **Term** is selected, three amount fields appear — **Term 1, Term 2, Term 3**.
They are pre-filled with total ÷ 3 (whole rupees) as a convenience, and the Admin can
edit each one. The three amounts must add up exactly to the Total fees, otherwise the
form shows an error and won't save. (Admin controls the exact split — the app does not
auto-round on its own.)

## What gets created when the student is saved

- **Single plan** → one payable fee for the full total, due on admission.
- **Term plan** → three payable fees:
  - Term 1 — due on admission (today)
  - Term 2 — due 3 months after admission
  - Term 3 — due 6 months after admission
  - Each labelled "Term 1 of 3", "Term 2 of 3", "Term 3 of 3", with its due date.

Each fee starts as unpaid/pending. Parents pay them one by one via the existing flow
(view active UPI ID → pay in their UPI app → submit UPI reference → Admin verifies →
Paid). Amounts are fixed by the fee record; parents cannot change them.

## Existing students (already in the system)

Admin/MD can set a fee plan on students who don't have one yet, using the same
Single/Term options and installment entry. A plan can be (re)configured only while no
payment for that student has been submitted or verified yet; once payments are in
progress the plan is locked to avoid disturbing money already collected.

## User flow

**Admin/MD adds a student:** enter name, parent name, parent phone, class, age →
enter total fees → pick Single or Term → (Term: confirm/adjust the 3 amounts) → Save.
The child's fee(s) are created immediately and the parent sees them right away.

**Parent pays:** opens Fees → sees each fee with its amount, due date and status →
pays and submits the UPI reference → waits for Admin verification → status becomes Paid.

**Reminders:** the existing Admin "Send Fee Reminder" works per pending fee, including
each unpaid term installment.

## UI/UX feel
Reuses the current Add Student modal, fee cards, buttons and spacing — the new fields
sit inside the existing form; term amounts appear only when Term is chosen. Fee/due
dates and "Term x of 3" labels use the existing fee list styling. No redesign, no new
navigation.

## Implementation phases

### Phase 1 — Built now
Parent name + Total fees + Plan type on Add Student; term installment amount entry with
sum validation; automatic creation of the single fee or the three term fees with due
dates (admission, +3, +6 months); fee-plan configuration for existing students (locked
once payments begin); parents see and pay each fee through the current UPI flow;
existing reminders and reporting work unchanged over these fees.

### Phase 2 — Later
Editing/adjusting a plan after payments have started (e.g. revised balance); custom
number of installments or custom due dates; per-class default fee templates.

### Phase 3 — Later
Automated scheduled reminders as each term due date approaches; sibling/discount logic;
receipts summarising the full plan and remaining balance.

## Assumptions
- Term = exactly 3 installments; first due on admission, then +3 and +6 months.
- Term amounts are entered by the Admin (prefilled with total ÷ 3) and must sum to the
  total; the app validates this rather than auto-rounding.
- Amounts are whole rupees, no decimals.
- Parent name is required and becomes the parent account's display name; if a parent
  account already exists for that phone, its name is updated to the entered value.
- A student has one active fee plan at a time; existing-student setup is allowed only
  before any payment is submitted/verified.
- The existing UPI submit → Admin verify → Paid flow, reminders, and reporting are
  reused as-is; only the way fees are created changes.
- Due dates are shown to guide payment; overdue fees are not auto-penalised in Phase 1.
