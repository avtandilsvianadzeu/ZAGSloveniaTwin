# Object inbox

Colleagues send the objects they draw on the Add object page to the shared map. They sign in with their ZAG address and a one-time code, and nothing is published until the owner approves it.

## How it works

1. A colleague draws an object on the Add object page and presses **Send to the ZAG map**.
2. A new tab opens the inbox. Cloudflare Access asks for an address ending in @zag.si and emails a one-time code to it. The inbox itself never sends email.
3. The colleague checks the object and sends it. It waits in a private queue (Workers KV) for up to 90 days.
4. The owner opens `/review` on the inbox. **Approve and publish** adds the object to `data/user_objects.json` in this repository, marked as not verified and without the sender's address. **Reject** deletes it.

The inbox only accepts the fields the Add object page writes, positions inside Slovenia, at most 20 objects per person per day, and sources that start with https.

Everything runs on Cloudflare's free plans: Workers, Workers KV and Zero Trust Access, which is free for up to 50 users. Cloudflare may ask for a payment card when the free Zero Trust plan is chosen.

## Setting it up, once

1. **Cloudflare account.** Create a free account at dash.cloudflare.com. Note the **Account ID** on the Workers and Pages overview.
2. **API token.** In My Profile, API Tokens, create a token from the template "Edit Cloudflare Workers". Make sure it can also edit Workers KV Storage.
3. **GitHub token.** In GitHub, Settings, Developer settings, Fine-grained tokens, create a token for this repository only, with **Contents: Read and write**.
4. **Repository secrets.** In this repository, Settings, Secrets and variables, Actions, add:
   - `CLOUDFLARE_API_TOKEN` from step 2
   - `CLOUDFLARE_ACCOUNT_ID` from step 1
   - `INBOX_GITHUB_TOKEN` from step 3
5. **Deploy.** In Actions, run **Object inbox**. The inbox appears at `https://digitalzag-inbox.<your-subdomain>.workers.dev`.
6. **Sign-in with ZAG addresses.** In the Cloudflare dashboard, open the Worker, Settings, Domains and Routes, and enable **Cloudflare Access** for workers.dev. Then in Zero Trust, Access, Applications, open that application:
   - Policy: **Allow**, include **Emails ending in** `@zag.si`.
   - Login method: **One-time PIN**.
   - Copy the **Application Audience (AUD) tag**, and note the team name from Settings, Custom Pages (`<team>.cloudflareaccess.com`).
7. **Two more secrets.** Add `ACCESS_AUD` (the tag) and `ACCESS_TEAM` (the team name) as repository secrets, and run **Object inbox** again.
8. **Show the button.** In `data/inbox.json`, put the inbox address in `"objects"`. From then on the Add object page shows **Send to the ZAG map** on each saved object.

To review: open `https://digitalzag-inbox.<your-subdomain>.workers.dev/review` and sign in with the owner address.
