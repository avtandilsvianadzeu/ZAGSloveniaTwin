# AI reader for the ZAG Digital Atlas

A small server that lets the Add object tool read a description, a text file or a picture and fill the form as a draft. It runs as a Cloudflare Worker. The site on GitHub Pages stays as it is. The AI key lives only in the Worker and never reaches the browser.

Files: `worker.js` is the whole server. `test.mjs` tests it on your computer without any account (`node test.mjs`, needs Node 18 or newer).

## What you need

1. A Cloudflare account. The free plan is enough to start.
2. An AI key from the Claude Console (https://platform.claude.com). The use is billed to that account for every request. Set a monthly spending limit there before you share the access code.
3. An access code that you invent, for example four random words. Only people who know it can use the reader.

## Set it up in the Cloudflare dashboard

Menu names can differ a little, because Cloudflare changes its dashboard from time to time.

1. Open Workers and Pages, create a Worker, give it a name such as `zag-atlas-ai`, and deploy the starter.
2. Open the code editor of that Worker, delete the starter code, paste the whole content of `worker.js`, and deploy.
3. Open Settings, then Variables and Secrets, and add:
   - `ANTHROPIC_API_KEY` as a secret, with your AI key
   - `ACCESS_CODE` as a secret, with your access code
   - `ALLOWED_ORIGIN` as plain text, with `https://avtandilsvianadzeu.github.io`
   - optional: `MODEL` as plain text. Default is `claude-haiku-5-5`. `claude-sonnet-5-5` reads drawings more carefully and costs more.
   - optional: `DAILY_LIMIT` as plain text, the number of requests per day. Default is 200.
4. Deploy again. Open the Worker address in a browser. It should answer `{"service":"ZAG Digital Atlas AI reader","ready":true}`.
5. In the site repository open `data/ai_service.json` and put the Worker address in `url`, for example `{"url":"https://zag-atlas-ai.yourname.workers.dev"}`. Never put the key or the access code in that file.
6. Open `add.html` on the live site, enter the access code, paste a description and press "Read with AI".

To test before step 5, leave `data/ai_service.json` empty and paste the Worker address into the "Service address" field on `add.html`.

## What it does and does not do

- It sends your text or picture to the AI with strict rules: report only what the input states or shows, never guess a dimension, a year or a coordinate, and quote where each value was read.
- It checks the answer before returning it. Values that do not fit are dropped: negative or absurd numbers, coordinates outside the globe, links that do not start with http or https.
- From a photograph alone it gives the type and a neutral description. It gives no dimensions unless they are written in the picture.
- It does not place an object from a place name. The tool only moves the map there, and the user draws the shape.
- It stores nothing. Every draft comes back marked `verified: false`, and the tool shows it as "AI draft, not verified".

## Protection and its limits

- Only the site in `ALLOWED_ORIGIN` may call it from a browser, and every request needs the access code.
- At most 6 requests per minute from one address, and `DAILY_LIMIT` per day. These counters live in the memory of the Worker, so they restart when Cloudflare restarts the Worker. They slow abuse down. They are not a hard budget.
- The hard budget is the spending limit of the AI account. Set it.
- If the access code leaks, change `ACCESS_CODE` and deploy. The old code stops working at once.
- The header `anthropic-version: 2023-06-01` and the request format follow the Messages API as documented in November 2026 (https://platform.claude.com/docs/en/api/messages/create). If the AI service changes its API, this is the place to update.

## Not built

A login per person and a shared review queue. Today every user with the access code has the same rights, and saved objects stay in the browser until someone uploads `user_objects.json` to the repository.
