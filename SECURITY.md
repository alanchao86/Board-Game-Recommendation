# Security Notes

## Secrets and Credentials

1. Never commit real `.env` files (`.env`, `.env.prod`, etc.).
2. Use example templates only:
   - `.env.local.example`
   - `.env.prod.example`
3. Rotate any token or credential immediately if it is exposed in logs, chats, screenshots, or commits.

## Deployment Safety

1. `JWT_SECRET` is required at runtime and must be set in environment variables.
2. Keep database ports private (`5432` should not be publicly exposed).
3. Prefer HTTPS for all public deployments.

## Local Defaults

Some compose defaults are intentionally development-only convenience values.
Do not reuse those values in shared or production environments.
