# SnapCart Store

Fresh rebuild. Simple HTML + CSS + JS. COD only.

## Run
Open `index.html` or:
```bash
npx serve .
```

## Menu
Home · Shop · About · Track Order · Contact · **Admin**

## Product URL (Meta Ads)
`#product/intelligence-book`

## Admin
- Link: **Admin** in main menu → `admin.html`
- Email: `admin@snapcart.in`
- Password: `SnapCart@Admin2026` (hashed, change in Security)

## Price
₹499 (MRP ₹1,299)

## Clear old cache
If you tested an older build, hard refresh (Ctrl+Shift+R) or clear site data once.


## Supabase (cloud orders & admin)

Full step-by-step guide:

→ **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**

Quick:
1. Create project at supabase.com
2. Run `supabase-schema.sql` in SQL Editor
3. Create Auth user (Authentication → Users)
4. Paste Project URL + anon key into top of `supabase.js`
