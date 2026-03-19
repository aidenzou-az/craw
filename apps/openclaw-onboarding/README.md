# OpenClaw Onboarding App

Node.js prototype for the Feishu lazy-pack Open Claw onboarding service.

This app contains:

- Edge Functions-compatible handlers
- in-memory and KV-backed repositories
- Open Claw runtime mock
- tests for the main onboarding flow
- EdgeOne Pages adapter used by `/functions/*`

## Structure

- `src/api/`: API handlers
- `src/services/`: auth and onboarding logic
- `src/store/`: mock repositories
- `src/runtime/`: Open Claw local runtime mock
- `test/`: Node.js tests

## Run

```bash
npm test
```

## EdgeOne Pages

This repo is structured for Tencent Cloud EdgeOne Pages:

- static landing page: repository root `index.html`
- Edge Functions entrypoints: `functions/`
- app source: `apps/openclaw-onboarding/`

The EdgeOne function wrappers import the app handlers from `apps/openclaw-onboarding/src/edgeone/adapter.js`.

Required KV binding:

- `ONBOARDING_KV`
