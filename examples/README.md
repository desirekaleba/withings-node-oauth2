# Examples

Runnable examples for `withings-node-oauth2`. They import the package by name and
are type-checked against the source via `tsconfig.examples.json`
(`pnpm typecheck:examples`).

| File                    | Shows                                                    |
| ----------------------- | -------------------------------------------------------- |
| `express.ts`            | Full OAuth2 flow + fetching the latest weight (Express). |
| `webhook-receiver.ts`   | Subscribing to Notify events and parsing callbacks.      |
| `polling.ts`            | Paginating history with async iterators + hooks.         |
| `custom-token-store.ts` | A Redis-backed `TokenStore` for token persistence.       |

To run one (they need real Withings credentials in the environment):

```sh
npm i -g tsx
WITHINGS_CLIENT_ID=… WITHINGS_CLIENT_SECRET=… WITHINGS_CALLBACK_URL=… \
  tsx examples/express.ts
```
