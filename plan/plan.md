# Klinara Kids: Push Notifications with Firebase (google-services.json)

This turns on real phone notifications for Klinara Kids. Android uses the Firebase `google-services.json` file, and iPhone uses an Apple key added at build time.
Parents, teachers and the MD get instant alerts for the school events that matter, and tapping one opens the right screen in the app.

## Who it's for
- **Parents:** hear about announcements, new class photos, fee dues, payment confirmation and absences without opening the app.
- **MD:** gets alerted right away to new complaints and data deletion requests.
- **Admin / MD:** keep getting the alert when a parent submits a UPI payment for verification (already in place).

## Findings that shape this plan
- **Most of the notification code already exists:**
  - The app asks for permission after login.
  - It registers each phone with Emergent's managed push service.
  - It opens the right screen when a notification is tapped, even if the app was closed.
  - The server already sends some alerts.
- **The Firebase file is missing:** the app's Android settings point to `google-services.json`, but the file isn't in the project. Without it, notifications can't be delivered on Android and the Android build would fail. Adding it is the main step.
- **The Android app ID will change:** it is currently `com.emergent.nurserydash.qnzmux`, while the iPhone app uses `com.klinarakids.app`. As agreed, Android switches to **`com.klinarakids.app`**, and the Firebase file must be created for that exact ID.
- **Testing needs a real build:** notifications don't work in Expo Go or the web preview. They can only be tested after Publish → Deploy → Generate the Android and iOS builds.

## Getting the google-services.json file (step by step)
1. Open **https://console.firebase.google.com** and sign in with the school's Google account.
2. Tap **Create a project** (or **Add project**), name it **Klinara Kids**, and finish the setup. Google Analytics can be turned off.
3. On the project page, tap the **Android** icon to add an Android app.
4. Enter the package name exactly: **`com.klinarakids.app`**. The nickname can be "Klinara Kids Android". The SHA-1 key can be left empty.
5. Tap **Register app**, then **Download google-services.json**.
6. Skip the remaining Firebase steps ("Add Firebase SDK" and so on). They aren't needed.
7. Attach the downloaded file in this chat.

**Later, when generating builds, the Publish screen will ask for two more items. It shows step-by-step guides for both.**
- A **Google service account JSON** for sending to Android. This is a different file from `google-services.json`.
- An **Apple APNs key (.p8)** for iPhone notifications.

## Core features and experience
1. **Firebase connected for Android:** the file is added, the Android app ID becomes `com.klinarakids.app`, and the Android build is ready for notifications. iPhone needs no extra file now.
2. **Notifications that already work stay as they are:**
   - New announcement → all parents → opens Announcements
   - New activity photo/post for a child → that child's parent → opens the Feed
   - Fee reminder sent by Admin/MD → that parent → opens Fees
   - Payment verified or rejected → that parent → opens Fees
   - Parent submitted a UPI payment → Admin and MD → opens Payment Verifications
   - New data deletion request → MD
3. **New notifications:**
   - **Automatic fee due reminders:** the parent gets one alert **3 days before** a fee is due and one **on the due date**, for unpaid fees only. These come in addition to the existing manual "Send Fee Reminder" button. Each reminder goes out once, never repeated.
   - **Payment confirmed:** a clear "Payment received ✓" alert with the amount when the Admin verifies a payment. This improves the wording of the existing alert.
   - **Child marked absent:** when a teacher saves a child as Absent, the parent gets an alert like "Aarav was marked absent today". It goes out at most once per child per day. "Present" and "Late" don't send an alert.
   - **New complaint → MD:** when a parent submits a complaint, the MD is alerted and taps through to Complaints.
   - **New deletion request → MD:** taps open the Deletion Requests list. The alert already exists; it gains the tap link.
4. **Tapping any notification** opens the matching screen for that person's role. If the app was closed, it opens to that screen.
5. **Permission handling:** this stays as it is today. The app asks for permission after login. If the parent says no, the app still works fully, and a gentle weekly reminder offers to open phone Settings.

## User flow
- **School owner (once):** creates the Firebase file using the steps above → attaches it in chat → Publish → Deploy → Generate builds → uploads the Google service account JSON and the Apple .p8 key when asked → installs the build on a phone.
- **Parent:** installs the app → logs in → allows notifications → gets alerts and taps one to see the details.
- **Teacher:** marks attendance as usual. Absent children's parents are alerted automatically.
- **MD:** gets an alert for each new complaint or deletion request → taps it → handles it in the app.

## UI/UX feel
- **Short and friendly messages:** the title names the event, the body gives the detail, for example "Fee due in 3 days · Term 2 of 3 · ₹10,000". There is no sound or design customisation beyond the standard phone notification.
- **App icon:** notifications use the Klinara teal accent color already set in the app.

## Implementation phases
### Phase 1 (MVP, built now)
- Add the user-supplied `google-services.json` and switch the Android app ID to `com.klinarakids.app`
- Automatic fee due reminders (3 days before and on the due date)
- Child-absent alerts to the parent, at most once a day
- New complaint alerts to the MD
- Clearer "payment received" wording, and tap links on all alerts, including deletion requests
- Keep all existing alerts and permission handling unchanged

### Phase 2 (later)
- Notification settings in Profile, so a parent can turn alert types on or off (for example, no absence alerts)
- Homework posted → parents of that class
- Reminders for events this week, the day before each event

### Phase 3 (later)
- A different notification sound for urgent alerts (absence, fee due today)
- An in-app notification history screen
- Telugu and Hindi notification text

## Assumptions
- **Android ID change:** the app isn't on Google Play yet under the old ID, so changing it to `com.klinarakids.app` is safe. Once the app is published, this ID can never change.
- **One Firebase project:** a single project named "Klinara Kids", owned by the school's Google account.
- **Push service:** notifications are sent through Emergent's managed push service. No other provider is used, and sending is billed to your Emergent credits.
- **Who gets each alert:**
  - Fee due reminders go only to the parent of the child whose fee is unpaid.
  - Complaint and deletion alerts go to the MD only, not to Admin.
  - Absence alerts are sent only when attendance is saved as Absent. Changing a mark later doesn't send a correction alert.
- **Reminder timing:** automatic reminders run once a day in the morning (India time).
- **Testing:** notifications can't be tested in Expo Go or the web preview. They only work after publishing and installing a generated build on a real phone.
- **Telling parents:** existing parents will be asked for notification permission the next time they open the new build.
