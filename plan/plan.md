# Klinara Kids — Parent Login with Username & Password

Parents stop logging in with phone number + OTP. They log in with a username and password, the same way Teacher, Admin and MD do.
The MD creates each parent's login while registering the student and can add or reset logins for existing parents.

## Who it's for
- **MD:** creates and manages parent logins, the same way they already do for teachers.
- **Parents:** sign in with the username and password the school gives them. No OTP wait and no SMS needed.

## Core features and experience
1. **New Parent Login page**
   - Shows the Klinara logo, a "Parent Login" title and the subtitle "Sign in with the details shared by your school".
   - Two fields: **Username** and **Password**. The password has a show/hide eye icon.
   - A teal **Login** button with a loading state.
   - A clear error message on a wrong username or password. The message is the same whichever one is wrong.
   - A "Forgot password?" link opens a simple screen: "Please contact the school office. The MD will reset your password."
   - The phone-number step, OTP step, resend timer and "Change number" link are removed completely.
2. **Parent login on Add Student (MD)**
   - The Add Student form gets a new "Parent Login" section with **Username** and **Password** fields, next to Parent name and phone.
   - The username must be unique across all users. A duplicate shows "Username already taken".
   - The password must be at least 6 characters, the same rule as teachers.
   - If the parent phone already belongs to a parent who has a login (a sibling joining), the section shows "Existing login: <username>". The new child is linked to that parent account and no new login is needed.
3. **"Set login" for existing parents (MD)**
   - Parents added before this change have no username yet. Their student rows show a **Set login** chip, like the existing "Set fee plan" chip.
   - Tapping it opens a small form with Username and Password. After saving, the parent can log in right away.
4. **Reset parent password (MD)**
   - On the MD's Users screen, parents now have the same **Reset password** action as staff. The MD types a new password. The parent's old sessions are signed out.
   - Activate/deactivate stays as it is today. Deactivated parents can't log in.
5. **Security, the same as staff:** 5 wrong attempts lock the account for 15 minutes. Passwords are stored securely and are never shown again after saving.

## User flow
- **MD registers a child:** Students → Add → child details, parent name, parent phone → Parent Login (username + password) → fee plan → Save. The MD shares the username and password with the parent.
- **MD fixes an existing parent:** Students → row with "Set login" → enters username + password → Save.
- **MD resets a forgotten password:** Users → parent → Reset password → enters a new password → shares it with the parent.
- **Parent:** Welcome → Parent → enters username + password → Login → lands on the parent home screen as today.

## UI/UX feel
The Parent Login page uses the same layout as Staff Login, so both feel like one app. It keeps the cream background, logo on top, rounded inputs, a teal button and the back button. The new MD fields sit inside the existing Add Student form and student list styling, with no redesign of other screens.

## Implementation phases
### Phase 1 — MVP (built now)
New username + password Parent Login page. OTP login removed from the app and the server. Username + password fields in Add Student, with a uniqueness check. "Set login" for existing parents. MD password reset for parents. Lockout after repeated failures. Updated Forgot password message.

### Phase 2 — Later
Parents can change their own password from their profile. The MD can edit a parent's username. A one-tap "Share login details" button sends the credentials to the parent on WhatsApp.

### Phase 3 — Later
Optional forced password change on first login. Admin (not only MD) allowed to manage parent logins if needed. Login activity history for the MD.

## Assumptions
- Only the MD can create, set or reset parent logins, the same as for teachers. Admin can't.
- The username is free text chosen by the MD (letters, numbers, dot, underscore, hyphen or an email). It isn't case-sensitive and must be unique across all users.
- Parents keep using the password the MD gives them. There is no forced change at first login.
- The parent phone number stays in the system as contact information and for linking siblings. It is no longer used to log in.
- One parent account can have more than one child. Adding a sibling reuses the existing login.
- Parents already in the system can't log in until the MD uses "Set login" for them.
- Anyone already signed in with the old OTP login stays signed in until their session expires (1 day). After that, they need the new username and password.
- Teacher, Admin and MD login doesn't change.
- The earlier plan (chat, multi-photo posts, staff password change) is dropped for now.
