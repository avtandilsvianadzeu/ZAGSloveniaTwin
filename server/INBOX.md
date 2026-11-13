# Request inbox: ZAGBOT requests without a GitHub account

Visitors press "Send the request" in ZAGBOT and it arrives as a GitHub issue. They need no account. The GitHub token lives only in the Worker.

## Set it up once (about 10 minutes, free)

1. **GitHub token.** github.com, your picture, Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token.
   - Repository access: Only select repositories, ZAGSloveniaTwin.
   - Permissions: Issues, Read and write. Nothing else.
   - Expiration: one year. Copy the token.
2. **Cloudflare Worker.** Sign up at dash.cloudflare.com (free plan). Workers and Pages, Create, Create Worker, name it `zag-inbox`, Deploy. Edit code, replace everything with the content of `server/inbox.js`, Deploy.
3. **Settings of the Worker**, Variables and Secrets:
   - `GH_TOKEN`, type Secret, the token from step 1
   - `OWNER_CODE`, type Secret, a passphrase you invent (for example four random words)
   - `ALLOWED_ORIGIN`, type Text, `https://avtandilsvianadzeu.github.io`
   Deploy again. Opening the Worker address should show `"ready":true`.
4. **Tell the site.** Put the Worker address in `data/inbox.json`, for example `{"url":"https://zag-inbox.yourname.workers.dev"}`.

## Use it

- Visitors: ZAGBOT, report something, "Send the request". The request waits for you.
- You: type `owner` in ZAGBOT once and enter the owner code. Your own requests then run at once. "Requests waiting" lists visitor requests with "Run it" and "Decline".
- Every request stays readable on GitHub without signing in, with ZAGBOT's answer.

## Protection

Only the site in `ALLOWED_ORIGIN` may call it. Visitors can send 3 requests in 10 minutes and 40 a day in total (best effort, see `DAILY_LIMIT`). Visitor requests never run without your approval, so nobody else can spend your Claude plan. If the owner code leaks, change `OWNER_CODE` and deploy.
