# kal — one-time setup

1. **Firestore** (Firebase console → project `trainerio-cf81a` → Firestore Database): if there is no database yet, create one in production mode, region `me-west1` (or the nearest). If a database already exists because another app uses this project, stop and tell Claude before step 2: publishing kal's rules would replace that app's rules.
2. **Rules** (Firestore → Rules): paste the contents of `firestore.rules` from this repo and Publish. Repeat whenever that file changes.
3. **Authorized domain** (Authentication → Settings → Authorized domains): add `yuda85.github.io`. Make sure the Google sign-in provider is enabled.
4. **Pages** (GitHub → yuda85/kal → Settings → Pages): Source = **GitHub Actions**. Then re-run the latest `deploy` workflow (Actions → deploy → Run workflow).
5. **Sign in** at https://yuda85.github.io/kal/ with Google. The wizard's first save will say it has no write permission and show your uid.
6. **Register as owner** (Firestore → Data): create collection `owners`, document id = your uid, one field `since` (string) = today's date. Save the wizard again.
7. **Connect Claude**: Settings screen → copy the config → paste it into `.claude/skills/kal/config.json` → commit (or give it to Claude).

On iPhone: if Google sign-in hangs inside the home-screen app, sign in from Safari first, or open the site in Safari instead of the home-screen icon.

Local development: `cd app && npx ng serve` → http://localhost:4310/ (`localhost` is authorized in Firebase by default).
