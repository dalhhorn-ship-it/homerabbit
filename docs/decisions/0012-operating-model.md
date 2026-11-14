# 0012 — Operating model: software-product, L2 plus two L3 items, Cloudflare Access email login

> Status: accepted · Date: 2026-11-14

## Context
homerabbit (docs/GOAL.md) is a private web app for two household members: log home chores with photos, rank,
kanban, progress. Photos of the home's interior are on the public internet, which the decision tree scores as L3.
There is no money, no regulated data and only two users. Mobile/iPad Chrome, IBM Carbon light design.

## Options
1. Full L3 — threat model, deploy checklist, audit every release. Safe but heavy for a two-person tool.
2. L1 light — smoke tests only. Too thin for an app that holds private photos and should live for years.
3. L2 plus two L3 items — tests, merge gate, review, CI; plus a security audit before the first daily-use
   release and an automated privacy test.

Login: (a) Cloudflare Access with email one-time PIN; (b) Google via Access; (c) own username/password.

## Decision
Option 3, path software-product, no secondary path, autonomy mode off. Login via Cloudflare Access with email
one-time PIN (user choice, 2026-11-14), allow-list of the two emails in the Cloudflare dashboard.

## Consequences
- No password handling in our code; the app must validate the Access JWT and reject everything else.
- Stack details (React + @carbon/react, Workers, D1, R2) still to be confirmed by `software-architect` in an ADR.
- Measure: tests ≤ 120 s, push-to-live ≤ 180 s, domain coverage ≥ 80%, running cost €0–5/month.
