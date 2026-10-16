# Phase 2: sitemap and wireframe notes

**Site:** DSWD website re-layout, built from the phase 1 design system (`css/`, `js/ui.js`, `img/icons.svg`).
**Served at:** `http://localhost/SLP/dswd/` (Apache serves `index.php` before `index.html`, so the phase 1 preview stays at `index.html`).
**Stack:** HTML5, CSS3, vanilla JS, PHP 8 for shared includes. Dynamic areas use placeholder data that phase 3 replaces with MySQL.

## Decisions made without asking (please check)

| # | Question | Answer used |
|---|---|---|
| 1 | Breadcrumbs on the home page? | No. Home is the root; every other page starts its trail with "Home". |
| 2 | What goes in the main nav? | 7 items: Programs and services, News, Downloads, Transparency, Offices, About us, Contact us. The logo links home. FAQs, Privacy, Terms and Sitemap live in the footer; FAQs is also linked from Contact. Nine items do not fit one row at 1024px. |
| 3 | How does search work? | The header "Search" is a link to `search.php`, so it works without JavaScript. The home hero has the main search field. |
| 4 | What does the language toggle translate? | Interface text: nav, headings, labels, buttons, footer. Content (programs, news) stays in English until the content system supplies Filipino (phase 3 has `title_fil`). The choice is kept in a cookie for one year and set with `?lang=fil` or `?lang=en`. The Filipino copy should be reviewed by a translator. |
| 5 | Social media links? | Text links ("Facebook", "YouTube") with the Lucide `external-link` icon. Lucide 1.x has no brand logos, and adding brand logos would break "one icon style". |
| 6 | Filters and search without JS? | Yes. Every filter is a normal GET form handled by PHP. |
| 7 | Where does placeholder data live? | `includes/data.php`, behind functions such as `get_programs()`. Phase 3 replaces the function bodies with MySQL queries and keeps the signatures. Each dynamic region in the HTML has `data-dynamic="…"`, and each placeholder value is marked `[Placeholder]` or `SAMPLE`. |
| 8 | Contact form submission? | The form posts to `contact.php`. Saving, the reference number and rate limiting come in phase 3. |
| 9 | FOI and Transparency Seal pages? | Sections on `transparency.php` (`#foi`, `#transparency-seal`). FOI links to the national eFOI portal. |
| 10 | Images? | One neutral placeholder SVG, lazy-loaded below the first screen, with `alt=""` while it is a placeholder. Real photos and their alt text come from the content system. |
| 11 | Officials? | Placeholder names and positions with no photos of real people, to stay non-partisan until the agency supplies approved content. |
| 12 | Sticky header? | CSS `position: sticky`, no script. `scroll-padding-top` keeps anchors and focused fields from hiding under it. |
| 13 | Official texts (mandate, vision, mission, hotlines, addresses)? | Bracketed placeholders and plain-language descriptions only. No official wording is invented. |

## Sitemap

```
Home ................................. index.php
├─ Programs and services ............. programs.php        ?type= &category= &q=
│  └─ Program or service ............. program.php?slug=   #eligibility #requirements #steps #forms
├─ News .............................. news.php            ?category= &q= &page=
│  └─ Article ........................ article.php?slug=
├─ Downloads ......................... downloads.php       ?category= &year= &q= &page=
├─ Transparency ...................... transparency.php    #transparency-seal #annual-reports #budget #issuances #foi
├─ Offices ........................... offices.php         ?region=
├─ About us .......................... about.php           #mandate #vision-mission #officials #org-chart
├─ Contact us ........................ contact.php         ?type=feedback|complaint|question
├─ FAQs .............................. faqs.php
├─ Search ............................ search.php?q=
├─ Privacy policy .................... privacy.php
├─ Terms of use ...................... terms.php
└─ Sitemap ........................... sitemap.php
```

## Three-click rule

Every program, service, requirement and form is reachable in 3 clicks or fewer from the home page:

| Goal | Path | Clicks |
|---|---|---|
| A program | Home → featured program card, or Programs and services → program | 1–2 |
| A service | Home → "Services" card (`programs.php?type=service`) → service | 2 |
| Requirements | Home → Programs and services → program (the requirements are on that page, linked from "On this page") | 2 |
| A form | Home → "Forms" card (`downloads.php?category=forms`) → file | 2 |
| A form from its program | Home → Programs and services → program → form link | 3 |
| Report a concern | Home → "Report a concern" card (`contact.php?type=complaint`) | 1 |

A crawler check in `tests/site-check.js` enforces this.

## Page template (every page)

1. Skip link, then a sticky header: logo and name, Search, and Menu (below 1024px). The nav row holds the main links and the language toggle.
2. **Title band** (`--green-100`): breadcrumbs, one H1 (`--green-900`), a one-sentence lead and, when it belongs at the top, the page's one primary action.
3. Content inside `.container`, on the 12-column grid.
4. Footer: contact details and hotline, social links, Privacy Policy, Terms, Freedom of Information, Transparency Seal, Sitemap.

Each page has exactly one `.btn--primary`.

## Wireframe notes

**index.php (Home)**
- Hero title band: H1 "How can we help you today?", a short lead, and a search form (label, field, primary "Search"). There are no breadcrumbs.
- Quick access: 4 link cards (Programs, Services, Forms, Report a concern), each with an icon, a title and one line. The whole card is clickable through its title link.
- From 1024px, two columns: latest news (3 items with thumbnail, date, category, title, "See all news") and announcements (pinned first, with dates).
- Featured programs: 3 program cards and "See all programs and services".
- Regional offices band: "Find your regional office" with a secondary button.
- Primary action: Search.

**about.php**
- Title band, then "On this page".
- Mandate (prose), Vision and mission (two cards), Officials (person cards with a placeholder image, name and position), and the Organizational chart as a nested list.
- Primary action: "Find a regional office".

**programs.php**
- Title band.
- Filter form: keyword, type (program or service), category, primary "Show results".
- Result count, a card grid of programs (link cards), and an empty state.

**program.php**
- Title band: H1 program name, lead summary, primary "Download the application form".
- "On this page", then the sections: About, Who can apply, What you need (checklist), How to apply (numbered steps), Forms (file list), Where to apply.
- Aside: a "Need help?" box with the hotline and a link to the offices.

**news.php**
- Title band.
- Filter form: search, category, primary "Search news".
- News list (thumbnail, date, category, title, excerpt), then pagination.

**article.php**
- Title band: H1, date and category.
- The cover image loads eagerly because it is on the first screen. Then the body (prose).
- Primary "See all news" at the end, then 3 related articles.

**downloads.php**
- Title band.
- Filter form: search, category, year, primary "Find files".
- Count, a table (Title, Category, Year, Size, Download) and pagination.

**transparency.php**
- Title band with primary "Download the latest annual report".
- "On this page", then the sections: Transparency Seal (required items with links), Annual reports, Budget and finance, Issuances, Freedom of Information (how to request, plus a link to the eFOI portal).

**offices.php**
- Title band.
- Region filter: select and primary "Show offices".
- Office cards: name, region, address, phone (`tel:`), email (`mailto:`) and hours.

**contact.php**
- Title band.
- Form: type (feedback, complaint or question), name, email, mobile (optional), subject, message, a privacy notice (RA 10173) and a consent checkbox. Primary "Send message".
- Aside: hotline, office hours and "Find an office".

**faqs.php**
- Title band.
- Topics: one H2 per topic, each with an accordion.
- Primary "Ask us a question", which goes to contact.

**search.php**
- Title band with the search form (primary "Search").
- Results grouped by type (programs and services, news, downloads, FAQs) with counts, and an empty state with tips.

**privacy.php, terms.php**
- Prose with placeholders. Primary "Contact us".

**sitemap.php**
- A nested list of every page. Primary "Search the site".

## Budget and accessibility rules

- Under 1 MB per page. The shared assets are about 85 KB. Images are lazy-loaded below the first screen.
- WCAG 2.1 AA: landmarks, one H1, alt text, keyboard access, visible focus, 44px targets, and no sideways scrolling at 320px.
- Plain language: short sentences, verbs on buttons, and no jargon in labels.
