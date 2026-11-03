"""Public, no-login HTML pages required by Google Play / Apple App Store:
privacy policy and account + data deletion request page."""

POLICY_VERSION = "1.0"
POLICY_EFFECTIVE = "16 October 2026"
LOGO = "https://customer-assets.emergentagent.com/job_a4a69bab-76bd-4aab-b87e-1d820620930f/artifacts/5n8sfahc_logo.jpeg"

CONTACT_HTML = """
<p><strong>Klinara Kids Pre-School, Hyderabad</strong><br>
Road No. 10, AGRL Housing Colony, Hastinapuram, Hyderabad 500079, Telangana, India<br>
Phone: <a href="tel:+917673920886">+91 76739 20886</a><br>
Email: <a href="mailto:admissions@klinarakids.com">admissions@klinarakids.com</a></p>
"""

_BASE_CSS = """
*{box-sizing:border-box}
body{margin:0;background:#f5f1e8;color:#1a3a3a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.6}
.wrap{max-width:760px;margin:0 auto;padding:24px 20px 64px}
header{display:flex;align-items:center;gap:14px;margin-bottom:8px}
header img{width:56px;height:56px;border-radius:14px;object-fit:cover;background:#fff}
h1{font-family:Georgia,serif;color:#2f6b6b;font-size:28px;margin:8px 0 4px}
h2{font-family:Georgia,serif;color:#2f6b6b;font-size:20px;margin:28px 0 8px}
.meta{color:#4a6b6b;font-size:14px}
.card{background:#fff;border:1px solid #e5dfd3;border-radius:16px;padding:20px;margin-top:16px}
a{color:#2f6b6b;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:8px;border-bottom:1px solid #e5dfd3;vertical-align:top}
th{color:#4a6b6b}
label{display:block;font-weight:600;font-size:14px;margin:14px 0 6px;color:#4a6b6b}
input,textarea{width:100%;padding:12px 14px;border:1px solid #e5dfd3;border-radius:12px;font-size:16px;background:#fff;color:#1a3a3a}
button{margin-top:20px;width:100%;padding:14px;border:0;border-radius:999px;background:#2f6b6b;color:#fff;font-size:16px;font-weight:700;cursor:pointer}
button:disabled{opacity:.6}
.ok{background:#4a8b6b18;color:#2f6b4b;border-radius:12px;padding:14px;margin-top:16px;display:none}
.err{color:#b85c5c;font-size:14px;margin-top:10px;min-height:20px}
footer{margin-top:40px;color:#8a9a9a;font-size:13px}
"""


def _page(title: str, body: str) -> str:
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · Klinara Kids</title><style>{_BASE_CSS}</style></head>
<body><div class="wrap">
<header><img src="{LOGO}" alt="Klinara Kids logo"><div><strong>Klinara Kids</strong><div class="meta">Raising Little Stars</div></div></header>
{body}
<footer>© Klinara Kids Pre-School, Hyderabad · <a href="/api/privacy">Privacy Policy</a> · <a href="/api/delete-account">Delete my data</a></footer>
</div></body></html>"""


PRIVACY_BODY = f"""
<h1>Privacy Policy</h1>
<div class="meta">Version {POLICY_VERSION} · Effective {POLICY_EFFECTIVE}</div>

<p>This policy explains how <strong>Klinara Kids Pre-School, Hyderabad</strong> ("Klinara Kids", "we", "the school") collects, uses and protects personal data in the <strong>Klinara Kids</strong> mobile app. The app is used by parents of enrolled children and by school staff (teachers, administrators and the Managing Director). Children do not use the app themselves.</p>

<h2>1. Data we collect</h2>
<table>
<tr><th>About</th><th>Data</th></tr>
<tr><td>Parent / guardian</td><td>Name, mobile number, app username, an encrypted (hashed) password, consent choices, complaints and messages you submit, fee payment references (UPI transaction ID) you enter.</td></tr>
<tr><td>Child</td><td>Name, age, class, photo (optional), attendance, daily activity notes and photos posted by teachers, homework, fee plan and payment status, and Elthea GROW assessment results (only if you opt in).</td></tr>
<tr><td>Staff</td><td>Name, work email, role, class, attendance and salary records.</td></tr>
<tr><td>Device</td><td>A push-notification token so we can send school alerts. We do not collect location, contacts, advertising IDs or browsing history.</td></tr>
</table>

<h2>2. Why we use it</h2>
<p>Only to run the pre-school: sharing your child's attendance, activities, homework, schedule and announcements with you; managing admissions, fees and receipts; staff administration; answering complaints; and keeping the app secure. We do <strong>not</strong> show ads, sell data or use data for profiling or marketing. We do not track or monitor children's behaviour beyond normal classroom records.</p>

<h2>3. Who can see it</h2>
<ul>
<li><strong>You</strong> see only your own child(ren)'s information.</li>
<li><strong>Teachers</strong> see the children in their class.</li>
<li><strong>Administrators and the Managing Director</strong> see school-wide records needed to run the school.</li>
<li><strong>Service providers</strong> that host the app (cloud servers and database), deliver push notifications, and, only if you opt in, <strong>Elthea</strong> (see section 4). They act on our instructions and may not use the data for their own purposes.</li>
</ul>
<p>We share data with authorities only when required by Indian law.</p>

<h2>4. Elthea AI assessment (optional)</h2>
<p>Elthea is a third-party developmental assessment ("GROW": Grow, Relate, Observe, Wonder). It is <strong>off by default</strong>. It runs only if a parent turns it on in the app. When it is used, your child's first name, age and class plus the assessment answers are processed by Elthea, whose servers may be located outside India. The results are stored in Klinara Kids and are visible to you and to school staff. You can turn Elthea off at any time in <em>Profile → Privacy</em>. No new assessments will run, and you can ask us to delete earlier results.</p>

<h2>5. How long we keep data</h2>
<ul>
<li>Account, child profile, attendance, activities and Elthea results are kept while your child is enrolled, and deleted within <strong>30 days</strong> after you request deletion or after your child leaves (unless you ask us to keep them).</li>
<li>Fee invoices and payment records are kept for up to <strong>8 years</strong>, because Indian tax and accounting laws require it. They are kept only for that purpose.</li>
<li>Security logs (such as failed-login counters) are kept for a short time only.</li>
</ul>

<h2>6. Security</h2>
<p>Data is sent over encrypted connections (HTTPS). Passwords are stored only as secure hashes. Access is limited by role, and accounts are locked after repeated wrong passwords. If a personal-data breach happens, we will inform affected parents and the Data Protection Board of India as the law requires.</p>

<h2>7. Your rights</h2>
<p>Under India's Digital Personal Data Protection Act, 2023 you can:</p>
<ul>
<li>Access a summary of your and your child's data.</li>
<li>Correct or update it.</li>
<li>Withdraw consent, for example by turning Elthea off.</li>
<li>Ask for erasure.</li>
<li>Nominate another person to act for you.</li>
<li>Raise a grievance.</li>
</ul>
<p>Requests are answered within 30 days.</p>

<h2>8. Deleting your account and data</h2>
<p>In the app: <em>Profile → Delete my account</em>. Or use our public form at <a href="/api/delete-account">Delete my data</a>, or email <a href="mailto:admissions@klinarakids.com">admissions@klinarakids.com</a>. The Managing Director verifies the request and erases the parent account and the child's app data within 30 days. This includes the profile, photos, attendance, activities, complaints and Elthea results. Fee records are kept only as described in section 5.</p>

<h2>9. Children</h2>
<p>Children's data is collected only from their parent or guardian, at admission, for the child's education and safety. We ask for a parent's consent in the app before use and separately for Elthea.</p>

<h2>10. Changes</h2>
<p>If this policy changes, we will update the version and date above and show a notice in the app.</p>

<h2>11. Contact and grievance officer</h2>
<p>The Managing Director of Klinara Kids acts as the grievance contact for privacy questions or complaints.</p>
{CONTACT_HTML}
<p>If you are not satisfied with our response, you may complain to the Data Protection Board of India.</p>
"""

DELETE_BODY = f"""
<h1>Delete my account &amp; data</h1>
<div class="meta">Klinara Kids app · Klinara Kids Pre-School, Hyderabad</div>

<div class="card">
<p>Parents can ask Klinara Kids to permanently delete their app account and their child's data. You can also do this in the app: <strong>Profile → Delete my account</strong>.</p>
<p><strong>What is deleted:</strong> your parent login and profile, and your child's profile, photo, attendance, activity posts and photos, complaints and Elthea assessment results.</p>
<p><strong>What is kept, and why:</strong> fee invoices and payment records are kept for up to 8 years, because Indian tax and accounting laws require it. They are used for nothing else.</p>
<p><strong>Timeline:</strong> the Managing Director verifies the request with you and completes it within <strong>30 days</strong>. After deletion, your login stops working.</p>
</div>

<div class="card">
<form id="f" novalidate>
<label for="parent_name">Parent name *</label><input id="parent_name" maxlength="100" required>
<label for="username">App username</label><input id="username" maxlength="100" autocapitalize="none">
<label for="phone">Registered mobile number *</label><input id="phone" inputmode="numeric" maxlength="10" required>
<label for="child_name">Child's name *</label><input id="child_name" maxlength="100" required>
<label for="note">Anything else (optional)</label><textarea id="note" rows="3" maxlength="500"></textarea>
<div class="err" id="err"></div>
<button id="btn" type="submit">Submit request</button>
</form>
<div class="ok" id="ok">Request received. The school will contact you to verify it and complete the deletion within 30 days.</div>
<p class="meta" style="margin-top:16px">Prefer email? Write to <a href="mailto:admissions@klinarakids.com?subject=Delete%20my%20Klinara%20Kids%20data">admissions@klinarakids.com</a> with the same details.</p>
</div>

<h2>Contact</h2>
{CONTACT_HTML}

<script>
document.getElementById('f').addEventListener('submit', async function(e){{
  e.preventDefault();
  var err=document.getElementById('err'), btn=document.getElementById('btn'); err.textContent='';
  var v=function(id){{return document.getElementById(id).value.trim();}};
  var body={{parent_name:v('parent_name'),username:v('username'),phone:v('phone'),child_name:v('child_name'),note:v('note')}};
  if(!body.parent_name||!body.child_name){{err.textContent='Please enter the parent and child names.';return;}}
  if(!/^\\d{{10}}$/.test(body.phone)){{err.textContent='Enter the 10-digit mobile number registered with the school.';return;}}
  btn.disabled=true;
  try{{
    var r=await fetch('/api/public/deletion-requests',{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify(body)}});
    if(!r.ok){{var d=await r.json().catch(function(){{return{{}};}});throw new Error(d.detail||'Could not submit. Please try again or email us.');}}
    document.getElementById('f').style.display='none';document.getElementById('ok').style.display='block';
  }}catch(x){{err.textContent=x.message;btn.disabled=false;}}
}});
</script>
"""


def privacy_html() -> str:
    return _page("Privacy Policy", PRIVACY_BODY)


def delete_html() -> str:
    return _page("Delete my account & data", DELETE_BODY)
