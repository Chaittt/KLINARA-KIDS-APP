# Klinara Kids: One Add Student Form for MD and Admin

There will be a single Add Student form with the same fields everywhere. It is used from the Students page and from the Setup (Settings) page.
Admin can also add students and create the parent's username and password while doing so.

## Who it's for
- **MD:** gets the same complete form wherever they add a student.
- **Admin:** can now register new students, including the parent's login, without needing the MD.

## Core features and experience
1. **One shared Add Student form**
   - The Students page and the Setup page both open the same form with the same fields, in this order:
     - Student full name, class, age (optional)
     - Parent name, parent phone (10 digits)
     - Parent Login: username + password (min 6 characters, show/hide eye)
     - Fee plan: total fees, Single or Term (x3) with the 3 term amounts
   - The old short form on the Setup page is removed. It only asked for name, class, phone and age and still mentioned the phone OTP login. Its "Parent will auto-login via phone OTP" text goes with it.
   - Rules are the same everywhere:
     - Usernames must be unique; a duplicate shows "Username already taken".
     - The password must be at least 6 characters.
     - Term amounts must add up to the total.
     - If the parent phone already has a login (a sibling joining), the form shows "Existing login: <username>" and reuses it.
   - After saving, the student list and the class strength counts refresh on both pages.
2. **Admin can add students**
   - The **Add** button on the Students page works for Admin. Today it is greyed out with "MD only".
   - The Setup page shows Admin an **Add Student** button that opens the same form.
   - Admin sets the parent's username and password as part of adding the student.
3. **What stays MD-only**
   - "Set login" for existing parents who have no login yet
   - Resetting a parent's password (Users screen)
   - Deleting students
   - Adding teachers and admins, User & Login Management, fees, salaries and UPI settings on the Setup page

## User flow
- **Admin or MD, from Students:** Students → Add → fill the form → Add Student → the student shows up in the list.
- **Admin or MD, from Setup:** Setup → Add Student → same form → Add Student → class strength updates.
- **Parent:** logs in with the username and password set by the Admin or MD, as today.

## UI/UX feel
The form looks the way the current Students page form does today: a slide-up card, rounded inputs, a "Parent Login" section heading and a teal Add Student button. The Setup page keeps its current layout. Admin simply sees an Add Student button there too.

## Implementation phases
### Phase 1 (MVP, built now)
- One shared Add Student form used on the Students and Setup pages
- The outdated Setup form removed
- Admin allowed to add students and set the parent login while doing so
- All other MD-only actions stay as they are

### Phase 2 (later)
- Admin can use "Set login" for existing parents
- Edit student details (class, parent name, phone) from the student page
- Duplicate-phone warning that shows the sibling's name

### Phase 3 (later)
- Bulk import of students from a spreadsheet
- An activity log showing who (MD or Admin) added each student

## Assumptions
- Parents keep logging in with a username and password. Email isn't required, but a username may be an email address.
- Admin can create a parent login only while adding a student. "Set login" for existing parents and password resets stay MD-only.
- Deleting students stays MD-only.
- The Setup page's Add Teacher and Add Admin buttons stay MD-only. The Admin sees only the Add Student button in that section.
- The form fields and rules are exactly those of today's Students page form. No new fields are added.
