# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 2.x     | ✅        |
| 1.x     | ❌        |

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report privately via GitHub's
[**Security Advisories**](https://github.com/desirekaleba/withings-node-oauth2/security/advisories/new)
("Report a vulnerability"), or email the maintainer at
**desirekaleba@gmail.com**.

Please include:

- A description of the issue and its impact.
- Steps to reproduce or a proof of concept.
- Affected version(s).

You can expect an initial acknowledgement within a few days. Once a fix is
released, we're happy to credit you (unless you prefer to remain anonymous).

## Handling credentials

This library never logs your `clientSecret`, tokens, or signatures. When you
integrate it:

- Keep `clientId`, `clientSecret`, and tokens in environment variables or a
  secrets manager — never in source control.
- Persist rotated refresh tokens securely (they change on every refresh).
- Always pass a `state` value to `getAuthorizeURL` and validate it on callback.
