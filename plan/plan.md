# Klinara Kids: Compliance and Store Assets (Phase 3)

These are the legal pages, data deletion process, children's-data safeguards and store listing material needed to publish Klinara Kids on Google Play and the Apple App Store.
The work covers a public privacy policy, a public "delete my data" page, in-app deletion and consent, a DPDP Act review, and ready-to-upload screenshots, descriptions and a feature graphic.

## Who it's for
- **School owner / MD:** submits the app to both stores without being rejected for missing policies, and handles deletion requests from one place.
- **Parents:** can see clearly what data is collected about their child, give consent, and ask for deletion at any time.
- **Store reviewers (Google and Apple):** need working public links and an in-app deletion option before approving the app.

## Findings that shape this plan
- **The website has no privacy or deletion page yet.** https://www.klinarakids.com/ has Home, Programs, Admissions and Contact pages, but nothing for privacy or data deletion.
- **The website's inner pages don't open from a direct link.** Opening a page like `klinarakids.com/contact` directly returns "Not Found", even though it works when clicked from the home page. Store reviewers open policy links directly, so a privacy page added there would look broken to them until the site's hosting is fixed.
- **What the stores require:**
  - Google Play requires a public privacy policy link and a public web page where users can request deletion of their account and data. It must not be a PDF, and the app must also offer deletion inside the app.
  - Apple requires that users can start account deletion inside the app.
  - Turning an account off is not enough for either store.
- **DPDP Act:** the DPDP Rules were notified on 13 Nov 2025. The children's data rules (verifiable parental consent) take effect around **13 May 2027**. Schools and childcare centres are exempt from the parental-consent and tracking limits only when the data is used for education or child safety. Klinara's Elthea AI assessment is a US-based behaviour assessment, so it isn't clearly covered by that exemption and is treated as needing separate parent consent.

## What the "data deletion request" means
App stores require that a parent can ask the school to permanently erase their account and their child's data from the app: profile, photos, attendance, Elthea results and fee history. They must be able to ask from inside the app or from a public web page. The plan uses the recommended approach: the request goes to the MD, who confirms it, and the data is erased within 30 days. Fee and payment records the school must keep by law are kept, with the reason stated.

## Core features and experience
1. **Public privacy policy page**
   - It is hosted at a permanent public link on the app's server, for example `<your Render server>/privacy`. It opens directly and works on any phone or computer.
   - It's written for Klinara Kids, Hyderabad, and covers:
     - What is collected: parent name, phone and username; the child's name, age, class and photos; attendance, activities, fees and Elthea results.
     - Why it's collected, who can see it (staff by role), the Elthea AI third party, how long it's kept, parent rights and the deletion process.
     - Contact for privacy questions: Road No. 10, AGRL Housing Colony, Hastinapuram, Hyderabad 500079 · 7673920886 · admissions@klinarakids.com.
   - The same text is provided in a form that can be pasted onto klinarakids.com later, once that site's direct links work.
2. **Public "Delete my data" page**
   - It is at a permanent public link, for example `<your Render server>/delete-account`, and names "Klinara Kids" as listed in the stores.
   - A simple form asks for parent name, username, phone and child's name, plus a "Submit request" button. The email admissions@klinarakids.com is shown as an alternative.
   - It explains what gets deleted, what is kept and why, and that requests are completed within 30 days.
3. **In-app deletion (required by both stores)**
   - **Parent side:** Parent Profile gets a **"Delete my account"** button. It shows a short explanation and a confirmation, then sends the request.
   - **MD side:** a new **Deletion Requests** list is added to User & Login Management. Each request shows who asked and when, with two actions: **Delete data** (permanently erases that parent and their children's app data) and **Reject** (with a reason).
   - **Updates:** the parent sees "Request received" and the status while it's pending.
4. **Parent consent and privacy notice in the app**
   - On a parent's first login, a one-screen privacy notice summarises what is collected and links to the full policy. Tapping "I agree" records the date and time.
   - There is a separate opt-in switch for the **Elthea AI assessment**, which is off until the parent turns it on. Until then, the parent sees no "Start Assessment" button.
   - Both are shown again from Parent Profile, so consent can be withdrawn there.
5. **DPDP Act review document**
   - This is a plain-language checklist of what the Act and the 2025 Rules expect for children's data, and where Klinara Kids stands on each item, marked done / built now / to do before May 2027.
   - It covers:
     - Notice and consent
     - Verifiable parental consent and how the school exemption applies
     - Limits on tracking children
     - Elthea as a third party, including transfer outside India
     - Data security
     - Breach reporting within 72 hours
     - Retention and erasure
     - The grievance contact
   - It is guidance only, not legal advice, and is marked for review by a lawyer.
6. **Store listing pack**
   - **Screenshots:** 6 screens with sample data, framed on a branded cream and teal background with a one-line headline each.
     - **The six screens:** Parent home, Activity feed, Attendance, Fees and UPI payment, Elthea GROW profile, and Teacher attendance marking.
     - **Sizes:** Google Play phone (1080×1920) and Apple iPhone 6.9" (1320×2868).
   - **Feature graphic (Google Play):** 1024×500 with the Klinara logo, "Raising Little Stars" and a phone preview.
   - **Text:**
     - **Google Play:** a short description (max 80 characters) and a full description (max 4000).
     - **Apple:** a subtitle (max 30 characters), promotional text (max 170), a description (max 4000) and keywords (max 100).
     - **Both:** a list of data-safety and privacy answers, ready to copy into the Play Console and Apple's privacy questionnaire.
   - All files are delivered together in one downloadable folder.

## User flow
- **Store reviewer:** opens the privacy link → reads the policy; opens the delete link → sees the request form; logs in with the demo parent → finds "Delete my account" in Profile.
- **Parent (first login):** logs in → reads the privacy notice → taps "I agree" → optionally turns on Elthea → lands on the home screen.
- **Parent (deletion):** Profile → Delete my account → confirms → sees "Request received". The MD reviews it → Delete data → the parent's login stops working and their data is erased.
- **Parent (web):** opens the delete page → fills in the form → the request appears in the MD's Deletion Requests list.
- **MD:** User & Login Management → Deletion Requests → reviews each one → Delete data or Reject.

## UI/UX feel
- **Public pages:** clean and readable, in the app's cream background and teal headings with the Klinara logo, readable on a phone, with no login needed.
- **In-app screens:** reuse the existing card and button style. "Delete my account" is shown in a calm red with clear wording.
- **Screenshots and feature graphic:** warm, friendly and uncluttered, with a short benefit headline above each phone screen.

## Implementation phases
### Phase 1 (MVP, built now)
- Public privacy policy page and public "Delete my data" page with request form, hosted on the app's server
- In-app "Delete my account" for parents, and a Deletion Requests list for the MD with permanent delete
- First-login privacy notice with recorded consent, and an Elthea opt-in switch
- DPDP Act review checklist document
- 6 framed screenshots in Play and Apple sizes, the 1024×500 feature graphic, all store descriptions and the data-safety answers

### Phase 2 (later)
- Move the policy pages onto klinarakids.com once its direct links work
- Email to the MD when a new deletion request arrives, and email to the parent when it's done
- Consent history export for the MD
- Tablet screenshots, if tablet listing is wanted

### Phase 3 (later, before May 2027)
- Stronger parental identity check if the exemption doesn't fully cover the school's use
- Breach-reporting procedure and data-retention auto-cleanup
- A short app preview video for both stores
- Privacy policy translations (Telugu and Hindi)

## Assumptions
- **Hosting:** the policy and deletion pages are hosted on the app's own server, not on klinarakids.com, because that site's inner pages fail when opened directly. The text is also provided to paste onto the website later.
- **Deletion handling:** the MD reviews requests and completes them within 30 days. Fee and payment records are kept for legal and accounting reasons and are stated as such.
- **Who can ask for deletion:** only parents can request deletion. Staff accounts are removed by the MD as today.
- **Policy details:** the privacy contact is admissions@klinarakids.com and 7673920886, and the school's legal name in the policy is "Klinara Kids Pre-School, Hyderabad". The policy dates and version are shown on the page.
- **Grievance contact:** the MD acts as the grievance contact. No separate Data Protection Officer is named.
- **Elthea:** it's treated as a third-party service that needs the parent's separate opt-in. Existing Elthea results stay visible but no new assessment starts without the opt-in.
- **Existing parents:** they see the privacy notice on their next login.
- **Apps without ads:** the app has no ads and no tracking tools. Store answers will state this.
- **Store targeting:** the store listings target parents (adults), not children. The app is marked "Education" and isn't entered into Google Play's "Designed for Families" / Kids category, because children don't use the app themselves.
- **Screenshot sample data:** screenshots use the demo sample data, with sample child names and stock-style placeholders, not real children's photos.
- **DPDP review:** the review is informational and should be checked by a lawyer before relying on it.
