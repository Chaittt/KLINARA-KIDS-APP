# Klinara Kids: Store & Compliance Pack

| Folder / file | What it is | Where it goes |
|---|---|---|
| `screenshots/google_play_1080x1920/` | 6 framed phone screenshots | Play Console → Main store listing → Phone screenshots |
| `screenshots/apple_iphone_6.9in_1320x2868/` | 6 framed iPhone 6.9" screenshots | App Store Connect → iPhone 6.9" Display |
| `feature_graphic/google_play_feature_graphic_1024x500.png` | Feature graphic | Play Console → Main store listing → Feature graphic |
| `store_listing.md` | Names, descriptions, keywords, data-safety and App Privacy answers, reviewer login | Copy into both consoles |
| `legal/privacy_policy.md` | Privacy policy text | Paste onto klinarakids.com later, once direct page links work |
| `legal/DPDP_Act_review.md` | DPDP Act / Rules 2025 checklist (guidance, not legal advice) | For the MD and the school's lawyer |
| `raw/` | Unframed app screens | Source images |
| `tools/` | `capture.py` (grabs screens) + `frame.py` (frames them) | Regenerate after UI changes |

**Live public links (no login needed), after you publish:**
- Privacy policy: `https://<your-production-server>/api/privacy`
- Delete my data: `https://<your-production-server>/api/delete-account`

Use these two URLs in Play Console (App content → Privacy policy, and Data safety → Delete account URL) and in App Store Connect (App Privacy → Privacy Policy URL).
