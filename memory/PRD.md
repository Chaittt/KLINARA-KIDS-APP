# Klinara Kids — Product Requirements Document (MVP)

## Overview
Cross-platform preschool management app (React Native Expo + FastAPI + MongoDB) connecting parents with school staff, with built-in Elthea AI developmental assessment.
- Tagline: **Raising Little Stars**
- Brand colors: Klinara Teal `#2f6b6b`, Cream `#f5f1e8`, Golden `#d4a574`, Beige `#d4b896`, Rose `#c49898`, Blush Pink `#ffc2cc`

## Tech Stack
- **Mobile**: React Native (Expo SDK 54, Expo Router, react-native-svg, expo-image-picker, AsyncStorage)
- **Backend**: FastAPI + Motor (MongoDB async) + bcrypt + PyJWT
- **Auth**: JWT Bearer tokens (1-day TTL) stored in AsyncStorage on the device

## Roles & Auth
| Role | Login method | Default credentials |
|------|--------------|---------------------|
| Parent | Phone + OTP (mock `123456`) | 9999999999 / 123456 |
| Teacher | Email + password (bcrypt) | teacher@klinara.com / Teacher@123 |
| Admin | Email + password | admin@klinara.com / Admin@123 |
| MD | Email + password | md@klinara.com / MD@123456 |

Backend enforces RBAC on every protected route; token role is the source of truth.

## Core Features

### Parent
- Welcome dashboard with child profile card, attendance %, fee status
- Daily activity feed (photo + caption + uploader + date)
- Attendance history (daily status + summary stats)
- Fee payment via mock UPI deeplink + payment history
- Elthea GROW radar chart + archetype card; "Start Assessment" launches Elthea (mocked)

### Teacher
- Class-wise student list
- Mark attendance (present / absent / late) per student per day
- Upload activity (photo from gallery + description) for a selected student

### Admin
- Dashboard: student/teacher/parent counts + pending fees
- Student CRUD (auto-creates parent user from phone)
- Teacher CRUD (sets bcrypt password)
- Fees overview with collected / pending totals
- Reports: today's attendance breakdown + financial summary

### MD (Super Admin)
- All admin features +
- Financial hero card with total revenue
- Monthly revenue bar chart

## Data Models (MongoDB)
- `users` — id, name, email (sparse unique), phone, password_hash, role, class_name?, created_at
- `students` — id, name, class_name, parent_phone, parent_id, age, photo (base64), elthea_grow {G,R,O,W}, elthea_archetype_name/description, elthea_last_assessed_at, created_at
- `attendance` — id, student_id, date (YYYY-MM-DD), status, marked_by, created_at
- `activities` — id, student_id, description, photo_base64, uploaded_by, uploader_name, created_at
- `payments` — id, student_id, amount, status (pending/paid), transaction_id, description, created_at, paid_at
- `otps` — phone, otp, expires_at (TTL), attempts
- `password_reset_tokens` — token, user_id, expires_at (TTL), used
- `login_attempts` — identifier (`ip:email`), count, locked_until

## Mocked Integrations (MVP)
- **OTP**: fixed `123456` returned in `debug_otp` field (replace with Twilio/MSG91 in prod)
- **UPI**: `/api/payments/initiate` returns a `upi://pay?...` deep link; `/api/payments/mark-paid` simulates success
- **Elthea AI**: `/api/elthea/launch` returns a mock URL `https://api.elthea.xyz/mock/...`; frontend simulates completion and calls `/api/elthea/complete` with sample GROW + archetype
- **Forgot password**: reset token returned in `debug_token` instead of via email

## Security
- bcrypt password hashing
- JWT 1-day expiry
- OTP: 2-min expiry, max 5 attempts, regenerated on resend
- Brute force: 5 failed staff logins → 15 min lockout
- RBAC enforced at API boundary via `require_roles(...)`
- Parent can only access their own child's data (verified by phone match)

## Future Enhancements (Smart Business Levers)
- **Sibling discount + auto-fee reminders** — every overdue payment auto-pings the parent and offers a 5% sibling discount on the second child's fee.
- **Elthea archetype share-card** — generate a beautiful share-card image of the child's GROW profile + archetype to share on WhatsApp; turns each parent into a marketing channel.
- Real Twilio OTP, Razorpay UPI, push notifications via Expo, S3 photo uploads.

## Iteration 2 — Added Features
- **Today's Schedule** for parents: replaced the parent-home Fees tile with a golden "Today / Schedule →" tile that opens `/parent/schedule`. Shows time-blocked daily schedule with LIVE indicator on the current slot. Schedule is class-based (Mon-Fri = 8 slots, weekends = optional fun club). Endpoint: `GET /api/schedule/today`.
- **Student detail page** at `/student/{id}` — accessible from admin and teacher student lists. Shows hero card, attendance quick stats, GROW radar chart + archetype, and a **progress timeline** (reverse-chronological merge of activities, milestones like "Joined Klinara" and "Elthea Assessment", plus absent/late marks).
- **Class-wise attendance heatmap** in admin/MD reports — last 14 days × classes grid with color-coded percentage cells and legend. Endpoint: `GET /api/reports/heatmap?days=N`.

## New Data Models
- `schedules` — id, class_name, day_of_week (0-6), start_time, end_time, activity, icon
