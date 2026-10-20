# Zari Lane — e-commerce storefront

Full-stack ethnic-wear store (lehenga cholis, sarees): catalogue, search, filters, variants, bag, coupons,
email-OTP login, addresses, shipping methods, UPI QR payments (online / advance + COD / COD), Twilio Verify OTP,
order confirmation, order tracking and a small admin for order status.

**Stack:** Next.js 15 (App Router) · React 19 · Tailwind CSS 4 · Prisma 6 (SQLite dev / Postgres prod) · Zod · jose (JWT sessions) · SendGrid / Twilio Verify OTP.

## Quick start

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # then set AUTH_SECRET (see below)
npx prisma migrate deploy   # creates prisma/dev.db
npm run seed                # 32 products, 7 collections, coupons, shipping methods, reviews
npm run dev                 # http://localhost:3000
npm test                    # pricing + signature self-checks
```

Generate an `AUTH_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Logging in during development
Login is email + OTP (the mobile number is only collected as delivery/contact data in the address form). With
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_VERIFY_SID` set, Twilio Verify emails and checks the code; the Verify
service needs an Email integration (a SendGrid account and verified sender) configured in the Twilio Console.
Without them, outside production, the OTP is shown under the OTP box ("Dev mode OTP") and printed in the server console as
`[otp] <email>: <code>`. In production Twilio is required. `ADMIN_EMAILS` addresses can open `/admin`.

## Payments (UPI QR)

Online payment uses two static UPI QR codes (`public/pay/qr1.jpeg`, `qr2.jpeg`) shown alternately per payment attempt.
Flow: `POST /api/checkout/order` (server re-prices the cart, creates a `PENDING_PAYMENT` order) → checkout shows the QR and the
exact amount → customer pays in any UPI app and submits the 12-digit UPI transaction ID (`POST /api/payments/submit`) →
an admin checks the money arrived and clicks **Confirm payment** in `/admin` (`POST /api/admin/orders/[id]/confirm-payment`) →
order `CONFIRMED`, stock decremented, bag cleared. Transaction IDs are unique, so one ID can't confirm two orders.

## Routes

| Page | Path |
|---|---|
| Home | `/` |
| Collection (filters, sort, infinite scroll) | `/:slug/collection/:id` |
| Product (variants, gallery, offers) | `/:slug/catalogue/:productId/:sku` |
| Search (typeahead) | `/search?q=` |
| Bag | `/bag` |
| Checkout (Login → Address → Payment) | `/checkout` |
| Orders / order detail + tracking | `/orders`, `/orders/:id` |
| Saved addresses | `/addresses` |
| Reviews | `/reviews` |
| Policies | `/about-us`, `/return-policy`, `/terms-and-conditions`, `/privacy-policy`, `/shipping-policy` |
| Admin (order status) | `/admin` |

## Project layout

```
prisma/            schema, migrations, seed
src/lib/           db, auth (OTP + JWT), cart, catalog, pricing, orders, validation, art (SVG product art)
src/app/api/       route handlers (auth, cart, coupon, products, search, addresses, checkout, payments, webhooks, admin)
src/app/(shop)/    pages with full header/footer
src/app/(flow)/    bag / checkout / account pages with the compact header
src/components/    UI (Store context, Listing, ProductDetail, Checkout, usePayment, …)
```

Product and banner images are generated SVG artwork (`/img/...`) until you import your own media.

## Importing your product photos & videos

```bash
npm run import -- path/to/folder            # add products
npm run import -- path/to/folder --replace  # also remove the demo products (ones never ordered)
```

`folder/products.csv` (header row required):

| column | example |
|---|---|
| name | `Wine Dola Silk Patola Lehenga Choli` |
| type | `Lehenga Choli` / `Saree` |
| color | `WINE` (used by the Colour filter) |
| price, mrp | `1599`, `2899` |
| sizes | `FREE SIZE:25` or `S:10\|M:10\|L:5` (size:stock) |
| description | free text (quote it if it has commas/newlines) |
| images | `wine/1.jpg\|wine/2.jpg` (relative to the folder) |
| collections | `LEHENGA CHOLI\|TOP SELLER` |

Videos in `folder/videos/*.mp4` are copied to `public/media/videos/` and play in the two home-page video blocks.
Images are copied into `public/media/products/`; commit that folder (or move it to object storage) when deploying.

## Deployment

### Render + Postgres (recommended)
`prisma/schema.prisma` already targets `postgresql`; the build command (`prisma db push && next build`)
pushes the schema to whatever `DATABASE_URL` is set at build time — no migration files to manage for a
single-environment deploy.

`render.yaml` in the repo root defines the web service + Postgres DB as a Render **Blueprint**:

1. Dashboard → **New → Blueprint** → pick this repo. Render provisions the `zarilane-db` Postgres
   instance and the `zarilane` web service, and wires `DATABASE_URL` automatically.
2. Fill in the env vars marked `sync: false` in `render.yaml`: `NEXT_PUBLIC_SITE_URL` (your
   `*.onrender.com` URL, known after the first deploy), `ADMIN_EMAILS`, and either real
   `SENDGRID_API_KEY`/`SENDGRID_FROM_EMAIL` (or `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_VERIFY_SID`) for login OTP emails,
   and `ADMIN_EMAILS` (who can confirm payments in `/admin`). `AUTH_SECRET` is generated for you.
3. Deploy. Seed once from your machine: `DATABASE_URL=<the Render Postgres external URL> npm run seed`.

(No blueprint? Create the Postgres instance and web service by hand instead — build command
`npm run build`, start command `npm start` — and set the same env vars.)

> If you outgrow a single environment (staging + prod, multiple devs), switch back to tracked
> migrations: `npx prisma migrate dev --name init` and `prisma migrate deploy` in the build command.

### Docker / VPS (SQLite)
```bash
docker build -t zarilane .
docker run -p 3000:3000 --env-file .env -v zarilane-data:/app/data -e DATABASE_URL=file:/app/data/prod.db zarilane
```
The container runs `prisma migrate deploy` on start; seed once with
`docker exec <id> npx tsx prisma/seed.ts`.

### Before going live
- Set the Twilio Verify vars and connect SendGrid to the Verify service so OTP emails are delivered.
- Stock is decremented on confirmation (no reservation during checkout) — see the `ponytail:` note in `src/lib/orders.ts`.
