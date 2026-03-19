# OpenClaw Onboarding App

Node.js prototype for the Feishu lazy-pack Open Claw onboarding service.

This app contains:

- serverless-style handlers
- mock stores and log-based status resolution
- Open Claw runtime mock
- tests for the main onboarding flow
- EdgeOne Pages adapter used by `/node-functions/*`

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
- Node Functions entrypoints: `node-functions/`
- app source: `apps/openclaw-onboarding/`

The EdgeOne function wrappers import the app handlers from `apps/openclaw-onboarding/src/edgeone/adapter.js`.
