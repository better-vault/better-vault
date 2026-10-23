# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report them privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Include the steps to reproduce, the impact and the affected version.

We aim to reply within a week and will credit you in the release notes unless you prefer otherwise.

## How better-vault handles secrets

- API keys are stored in the user's browser (IndexedDB) and sent with each request to the app's own API routes over the same origin.
- The routes pass keys to the chosen provider and never store or log them.
- Notebooks, sources and outputs never leave the browser except as model context for the provider the user picked.
- The web page fetcher (`/api/sources/parse`) only allows `http` and `https` addresses and refuses private and local network addresses.

## Supported versions

Only the latest release receives security fixes while the project is below 1.0.
