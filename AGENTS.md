# AGENTS.md

Guidance for automated agents (and anyone running an isolated dev stack)
in this repository. Human-oriented setup lives in CONTRIBUTING.md.

## Repository map

npm workspaces monorepo (one `npm install` at the root; node_modules is
hoisted):

- `packages/api` - Express/Mongoose API plus an S3-backed asset store
  (webpack build produces `server.js`).
- `packages/mui` - React/Vite UI (editor `/edit`, remote display `/display`,
  device auth `/device`).
- `packages/common` - shared types and geometry helpers.
- `compose.dev.yaml` - mongo + localstack (S3) for local development.

Both env files are gitignored; the committed examples are the source of
truth:

- `.env` (root) - `LOCALSTACK_AUTH_TOKEN` for the compose stack.
- `packages/api/.env` - API configuration (see `packages/api/.env.example`).

## Commands

| What | Where | Command |
| --- | --- | --- |
| Lint | `packages/api`, `packages/mui` | `npm run lint` |
| Typecheck | `packages/api` | `npm run typecheck` |
| API build | `packages/api` | `npm run build` (writes `server.js`) |
| API run | `packages/api` | `node --env-file=.env server.js` |
| API tests | `packages/api` | `npm test` (needs localstack S3 on `127.0.0.1:4566`; creates and drops its own `tbltp-test-*` buckets) |
| UI dev server | `packages/mui` | `npm start` (vite, port 4200) |
| UI unit tests | `packages/mui` | `npm run test:utils` |

## Auth-off mode

Set `DISABLE_AUTH=true` in `packages/api/.env` to run without Auth0:

- the API stubs auth (pseudo-user `noauth|0`) and `/noauth` returns
  `{"noauth":true}`;
- the editor tree is wrapped in `NoAuthProviderComponent`, which provides a
  stub Auth0 context and resolves the `NOAUTH` sentinel token (the same
  sentinel `/display` uses);
- the remote display skips the device flow and connects directly.

### Browser uploads and downloads need bucket CORS

Uploads send a presigned `PUT` and downloads a presigned `GET` from the
browser straight to localstack. Without a CORS policy localstack rejects the
preflight and the editor shows "Unknown error happened" (uploads) or images
fail to load (downloads). Configure it once per bucket (match the origin to
the UI port you serve):

```
docker compose -f compose.dev.yaml exec -T localstack awslocal s3api \
  put-bucket-cors --bucket tbltp-local --cors-configuration \
  '{"CORSRules":[{"AllowedOrigins":["http://localhost:4200"],"AllowedMethods":["GET","PUT","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3000}]}'
```

Note that presigned requests must not carry an `Authorization` header and no
query parameters may be appended to the URL - either breaks the signature.

## Isolated agent stack

Never use the developer's ports (`27017`, `4566`, `3000`, `4200`) or their
docker volumes. Run a parallel stack from a git worktree:

1. Create the worktree and link dependencies (no second `npm install`).
   Symlink each entry of `node_modules` (root and `packages/mui`) into the
   worktree so vite can create its own cache directory. If you have
   uncommitted changes, copy them into the worktree, and re-copy after every
   edit - the worktree is a plain checkout:

   ```
   git worktree add --detach /tmp/opencode/tbltp-agent HEAD
   ```

2. Worktree `.env` - your token plus alternate ports:

   ```
   LOCALSTACK_AUTH_TOKEN=<your token>
   MONGO_PORT=27018
   LOCALSTACK_PORT=4567
   ```

3. Start the stack under an isolated compose project and create the bucket.
   Always pass `-p tbltp-agent`; without it compose targets the developer's
   stack:

   ```
   docker compose -f compose.dev.yaml -p tbltp-agent up -d
   docker compose -f compose.dev.yaml -p tbltp-agent exec -T localstack awslocal s3 mb s3://tbltp-local
   docker compose -f compose.dev.yaml -p tbltp-agent exec -T localstack awslocal s3api \
     put-bucket-lifecycle-configuration --bucket tbltp-local --lifecycle-configuration \
     '{"Rules":[{"ID":"expire-staged-uploads","Filter":{"Prefix":"uploads/"},"Status":"Enabled","Expiration":{"Days":1}}]}'
   ```

4. Worktree `packages/api/.env` (no telemetry secrets):

   ```
   DISABLE_AUTH=true
   MONGO_URL=mongodb://localhost:27018/tbltp
   PORT=3100
   UI_URL=http://localhost:4300
   STORAGE_PROVIDER=s3
   STORAGE_S3_ENDPOINT=http://127.0.0.1:4567
   STORAGE_S3_BUCKET=tbltp-local
   STORAGE_S3_ACCESS_KEY_ID=test
   STORAGE_S3_SECRET_ACCESS_KEY=test
   STORAGE_S3_REGION=us-east-1
   STORAGE_S3_FORCE_PATH_STYLE=true
   ```

   CORS allows only `UI_URL`, so it must match the UI port you serve.

5. Build and run the API detached. Plain `nohup ... &` dies with the shell
   session; `setsid` (or an equivalent) is required:

   ```
   npm run build
   setsid nohup node --env-file=.env server.js > /tmp/opencode/agent-api.log 2>&1 < /dev/null & disown
   ```

6. Point the worktree UI at the agent API - edit the worktree copy of
   `packages/mui/public/env.json` (never the committed one) - and serve it.
   `vite.config.ts` hardcodes 4200; the CLI flag overrides it:

   ```
   {"API_URL": "http://localhost:3100", "WS_URL": "ws://localhost:3100/"}

   setsid nohup npx vite --port 4300 --strictPort > /tmp/opencode/agent-ui.log 2>&1 < /dev/null & disown
   ```

7. Configure upload CORS for this bucket (see above, origin
   `http://localhost:4300`).

The API logs `Authenticaiton disabled` (sic) and, without an OTEL collector,
periodic `ECONNREFUSED 127.0.0.1:4318` metric-export warnings - both are
harmless.

## Browser validation checklist (auth-off)

1. `http://localhost:4300/edit` renders the editor ("Editor Crash Course"),
   not the `UnavailableComponent`, and the console has no errors.
2. Drawer -> Assets; the toolbar "Create Asset" action adds `ASSET <n>`.
3. The image placeholder is exposed as "Upload asset image"; upload a file
   (e.g. `packages/api/test/assets/1x1.png`), then click the `save` button.
   Expect presign `POST /asset/:id/data` 200, `PUT` to `127.0.0.1:4567` 200,
   commit `PUT` 200, and the rendered image served from a
   `http://127.0.0.1:4567/tbltp-local/public/...` presigned URL
   (`X-Amz-Signature` query parameter; the browser requests the bucket
   directly and sends no `Authorization` header).
4. `http://localhost:4300/display` connects (console: "Websocket connection
   established") without redirecting to `/device`. With no scene selected
   the server closes the socket and the page shows "No scene information...";
   set one with `PUT /state` (`{"scene": "<id>"}`) or the editor's Scenes
   panel.

## Teardown

```
docker compose -f compose.dev.yaml -p tbltp-agent down -v
kill <api pid> <ui pid>
git worktree remove --force /tmp/opencode/tbltp-agent
```

## Known sharp edges

- Keep an accessible name on the asset upload placeholder
  (`titleAccess="Upload asset image"`); without it the control is invisible
  to accessibility tooling and agents cannot drive the file chooser.
- The first editor load against a cold database can 500 once on `GET /token`
  while concurrent requests race to create the pseudo-user. The API retries
  the duplicate-key create, so a reload clears it.
- `packages/api` has no local `node_modules`; run its scripts from within
  the package directory and use the worktree link trick when isolating.
- Localstack state is in-memory on the free plan: recreate the bucket and
  re-run the CORS command after recreating the container.
