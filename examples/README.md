# Examples

Runnable examples for `withings-node-oauth2`. They import the package by name and
are type-checked against the source via `tsconfig.examples.json`
(`pnpm typecheck:examples`).

The **focused** examples each teach one concept:

| File                    | Shows                                                    |
| ----------------------- | -------------------------------------------------------- |
| `express.ts`            | Full OAuth2 flow + fetching the latest weight (Express). |
| `webhook-receiver.ts`   | Subscribing to Notify events and parsing callbacks.      |
| `polling.ts`            | Paginating history with async iterators + hooks.         |
| `custom-token-store.ts` | A Redis-backed `TokenStore` for token persistence.       |

And the **playground** puts it all together:

| File           | Shows                                                                                                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard.ts` | A one-page live tester: the OAuth flow, every data resource, pagination, a file-backed `TokenStore`, retry/rate-limit/hooks, typed errors, and the utilities — each rendered as a live call you can eyeball in the browser. |

## Running them

They need real Withings credentials. Copy [`.env.example`](../.env.example) to
`.env` and fill it in (the examples load it via `dotenv`), or export the vars:

```sh
npm i -g tsx
WITHINGS_CLIENT_ID=… WITHINGS_CLIENT_SECRET=… WITHINGS_CALLBACK_URL=… \
  tsx examples/express.ts
```

For the dashboard, build the package first (so the self-import resolves), then
open <http://localhost:3000> and click **Connect**:

```sh
pnpm build && tsx examples/dashboard.ts
```
