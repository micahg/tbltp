# Network Table Top

Present tabletop assets on a remote screen.

## Mission

1. Eliminate paper maps
1. Run on any screen
1. Stay simple
1. Stay open source
1. Stay cheap

For cost -- try to keep it free for everyone even on hosted unless they want
asset storage.

Ideally give people the option to host their own install too.

## Docker

`ghcr.io/micahg/tbltp-mui` serves the UI on port 80. Configure it with:

| Variable | Example |
| --- | --- |
| `API_URL` | `https://api.example.com` |
| `WS_URL` | `wss://api.example.com` |
| `AUTH_DOMAIN` | `tenant.us.auth0.com` |
| `CLIENT_ID` | Auth0 client ID |
| `AUDIENCE_URL` | `https://api.example.com` |
| `REDIRECT_URL` | `https://ui.example.com/edit` |
