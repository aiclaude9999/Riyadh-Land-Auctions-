# Put Riyadh Meetup Point online (free)

Takes about 15 minutes. Everything below is free: **Vercel Hobby** (hosting, for personal non-commercial use;
if a monthly limit is ever reached it pauses, it never bills) and **Upstash Redis free plan** (stores shared
groups for 7 days). Mazad Radar (Netlify) is not touched.

## 1. Create the Vercel account
1. Open **vercel.com** → **Sign Up** → choose **Hobby** → **Continue with GitHub**.
2. Log in with the GitHub account that owns `Riyadh-Land-Auctions-` and allow Vercel.

## 2. Import the project
1. On the Vercel dashboard click **Add New… → Project**.
2. Next to **Riyadh-Land-Auctions-** click **Import**.
   (If it is not listed: **Adjust GitHub App Permissions** → choose the repository → **Save**.)
3. **Root Directory** → **Edit** → choose **meetup-point** → **Continue**.
4. Framework Preset shows **Next.js**. Leave everything else.
5. Click **Deploy**. The first deploy may fail or show an old page — that is expected, fix it in step 3.

## 3. Use the right branch
1. Project → **Settings → Environments → Production** (older screens: **Settings → Git**).
2. **Branch Tracking** → set the production branch to **`ccr-b5fb78cd-9zakhr`** → **Save**.
3. **Settings → Git → Ignored Build Step** → choose **Only build production** → **Save**
   (stops Vercel from building Mazad Radar's branch).

## 4. Add the free database (for sharing)
1. Project → **Storage** tab → **Create Database** (or **Browse Marketplace**).
2. Choose **Upstash → Upstash for Redis** → **Continue**.
3. Plan **Free**, region **Frankfurt (eu-central-1)** or the closest offered → **Create**.
4. When asked, connect it to this project (all environments) → **Connect**.
   This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.

## 5. Deploy again
1. Project → **Deployments** → the newest one → **⋯** → **Redeploy** → **Redeploy**.
2. When it shows **Ready**, click **Visit**. Your link looks like `https://riyadh-land-auctions-xxxx.vercel.app`.
3. Test: open the link on your phone → **Share with friends** → send the WhatsApp link to a second phone.
   The box must **not** say "only works on this computer".

## Optional
- Nicer name: **Settings → Domains** → edit the `.vercel.app` name (e.g. `riyadh-meetup.vercel.app`).
- Google keys later: **Settings → Environment Variables** → add `GOOGLE_MAPS_API_KEY` and
  `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` → Redeploy. (Restrict the browser key to your Vercel address.)

## Privacy
Anyone with a group link sees the names and starting points in that group. Groups are deleted after 7 days.
Preferences stay in each person's browser.
