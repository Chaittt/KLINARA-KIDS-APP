# DPDP Act, 2023 & DPDP Rules, 2025: Review for Klinara Kids

> **Guidance only, not legal advice.** Please have a lawyer review this before relying on it.
> Prepared: November 2026. Rules notified 13 Nov 2025. Most obligations, including the children's-data rules (Sec. 9 / Rule 10), apply from about **13 May 2027** (18 months after notification).

**Status key:** ✅ Done (built in the app) · 🟡 Partly done / process needed · ⬜ To do before May 2027

| # | Requirement (plain language) | Where it comes from | Klinara Kids status |
|---|---|---|---|
| 1 | **Clear notice** before collecting data: what is collected, why, how to withdraw consent, how to complain | Sec. 5, Rule 3 | ✅ First-login privacy notice in the app, plus a full public policy at `/api/privacy` (versioned) |
| 2 | **Consent** that is free, specific and recorded, and as easy to withdraw as to give | Sec. 6 | ✅ "I agree" is stored with date, time and policy version (`consent_log`). Elthea has a separate switch that can be withdrawn in Profile |
| 3 | **Verifiable parental consent** before processing a child's (under 18) data | Sec. 9(1), Rule 10 | 🟡 Parents are identified at admission and given credentials by the MD, which is a strong offline verification. Recommendation: keep signed admission forms on file as proof. ⬜ Add a consent clause to the paper admission form |
| 4 | **School exemption**: educational institutions and child-care centres are exempt from 9(1) and 9(3) only for **education and safety** | Sec. 9(4), Fourth Schedule | 🟡 Attendance, activities, homework, fees and announcements are core education and safety use, so they are likely exempt. **Elthea** (a US-based behaviour assessment) is not clearly covered, so it is opt-in only and off by default ✅ |
| 5 | **No tracking, behavioural monitoring or targeted ads aimed at children** | Sec. 9(3) | ✅ No ads, no analytics or tracking SDKs, no profiling. Elthea runs only with explicit parent opt-in |
| 6 | **Third parties (processors)** may act only under contract | Sec. 8(2) | ⬜ Sign a data processing agreement with Elthea and with the hosting and database providers |
| 7 | **Transfer outside India** is allowed unless the government restricts a country | Sec. 16 | 🟡 Disclosed in the policy and on the consent screen. ⬜ Re-check the restricted-country list before launch |
| 8 | **Reasonable security safeguards**: encryption, access control, logs | Sec. 8(5), Rule 6 | ✅ HTTPS, bcrypt password hashing, role-based access, lockout after 5 failed logins, session revocation on reset. ⬜ Enable database encryption at rest and keep access logs for 1 year (Rule 6) |
| 9 | **Breach reporting** to the Board and affected parents (detailed report within **72 hours**) | Sec. 8(6), Rule 7 | ⬜ Write a one-page breach procedure (who decides, template message, Board contact) |
| 10 | **Erase data** when its purpose ends or consent is withdrawn | Sec. 8(7), 12 | ✅ In-app "Delete my account" and a public web form. The MD completes them within 30 days, and erasure is real (not just deactivation). ⬜ Automatic clean-up after a child leaves the school |
| 11 | **Retention exception**: keep what the law requires | Sec. 8(7) | ✅ Fee and payment records are kept (tax and accounting law, up to 8 years), stated in the policy and on the delete page |
| 12 | **Rights of the parent**: access, correction, erasure, grievance, nomination | Sec. 11–14 | 🟡 Access is in the app. Correction goes through the MD. Erasure ✅. ⬜ Add a "Request my data summary" button (Phase 2) |
| 13 | **Grievance contact** published, with replies within a fixed time (≤ 90 days, per Rule 14) | Sec. 8(10), Rule 14 | ✅ The MD is named as the grievance contact, with address, phone and email in the policy. We commit to 30 days |
| 14 | **Data Protection Officer / audits** | Sec. 10 | Only for "Significant Data Fiduciaries", which is unlikely for a single pre-school. Not required now |

## Recommended next steps (before May 2027)
1. Add a short DPDP consent clause and signature to the paper admission form. This becomes the verifiable-consent record.
2. Get a data processing agreement from Elthea, including where data is stored and its retention and deletion terms.
3. Write a breach-response sheet with the 72-hour timeline and a parent message template.
4. Set up automatic deletion of a child's app data 6 months after they leave (fee records excepted).
5. Turn on encrypted backups and database encryption at rest with the hosting provider, and keep access logs for 1 year.
6. Re-review this document when the Data Protection Board issues further guidance.
