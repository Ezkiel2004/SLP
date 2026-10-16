# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML, CSS and vanilla JavaScript. No frameworks, no build step (the user's brief). Served by XAMPP at `http://localhost/SLP/dswd/`.

## Users

- **Citizens of all ages** looking for DSWD programs, who can get help, and how to apply. Many use phones on slow mobile data, and many are older adults or first-time internet users.
- **Developers and designers** who build the website's pages from this design system.

## Product Purpose

The design system for a redesigned website of the Department of Social Welfare and Development (DSWD), Philippines. Phase 1 delivers tokens, components and a preview page. Success means later pages can be built only from these parts, and every page stays readable, accessible and fast on a low-end phone.

## Positioning

The official, non-partisan source for social welfare information. Trust comes from plain language, consistency and restraint, not from promotion.

## Operating Context

Visitors arrive on phones, over slow or metered connections, often in daylight and sometimes on shared devices. Pages must work when scripts load late or not at all.

## Capabilities and Constraints

- Phase 1 scope: tokens, base styles, components (buttons, form controls, card, tabs, accordion, breadcrumbs, alerts, table, pagination, modal, header with mobile menu, footer), `ui.js`, icon sprite and preview page.
- No frameworks, no runtime third-party requests, self-hosted Inter, a Lucide SVG sprite.
- English only and light theme only for now. Filipino is a planned follow-up.
- Not decided yet: the official logo or seal, real page content, contact details.

## Brand Commitments

- Green and white only. Status colors (success, warning, error) appear only in feedback messages.
- One font (Inter), one icon set (Lucide), fully rounded buttons, 16px rounded cards and fields.
- Minimal, calm and formal: no gradients, no decorative animation, no heavy shadows.
- Non-partisan: no officials' names or photos and no political branding.

## Evidence on Hand

- No official DSWD logo or seal has been supplied. `img/logo.svg` is a placeholder, and using the seal needs DSWD authorisation.
- No real page content, hotlines, addresses or statistics have been supplied. Do not fabricate them; use bracketed placeholders.
- Real program names (for example, Sustainable Livelihood Program) may be used with plain descriptions and no figures.

## Product Principles

1. Plain before polished: every element must help a citizen find or do something.
2. Works on the worst connection: native HTML first, scripts only enhance.
3. Same thing, same look: one component per job, used the same way everywhere.
4. Never rely on one cue: color always comes with text or an icon.

## Accessibility & Inclusion

WCAG 2.1 AA: text at least 4.5:1, non-text at least 3:1, a visible 2px focus ring, 44 × 44px targets, keyboard access throughout, and reflow at 320px with no sideways scroll.
