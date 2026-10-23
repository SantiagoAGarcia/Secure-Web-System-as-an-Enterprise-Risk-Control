# Evidence Documentation

This directory contains the verification artifacts for the Secure Web System as an Enterprise Risk Control workshop.

## Verification Images

1. `authenticated-api-call.png`
   Screenshot demonstrating an authenticated API call over HTTPS from the React frontend, returning `status: protected` and the authenticated user's `subject` identifier.

2. `certificate-proof.png`
   Screenshot of the browser certificate viewer showing the valid Let's Encrypt TLS certificate issued for `santiago-risk.duckdns.org`, valid until January 20, 2027.

3. `port-8080-closed.png`
   Evidence demonstrating network perimeter security: direct public access to port 8080 times out from an external network, while access via the HTTPS reverse proxy (`https://santiago-risk.duckdns.org/api/risk-status`) returns HTTP 401 Unauthorized as expected.
