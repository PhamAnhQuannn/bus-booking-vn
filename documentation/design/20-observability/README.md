> ← [Previous](../19-compliance/) | [Index](../README.md) | [Next →](../21-feature-flags/)

## 20. Observability & Monitoring

### 20.1 Why "Buy, Not Build"

Building a custom monitoring dashboard is reinventing the wheel badly. Existing tools (Sentry, Datadog, Vercel Analytics) are battle-tested and purpose-built. We use them.

| Tool | What It Does |
|------|-------------|
| **Sentry** | Error tracking — catches unhandled exceptions, groups them, alerts on new/regression errors, shows stack traces with source maps |
| **Vercel Analytics** | Traffic metrics — page views, response times, serverless function invocations, cold starts |
| **Structured Logs** | Application logging — JSON-formatted logs with request ID, user ID, operation name, timing |
| **`/api/health`** | Health endpoint — returns 200 if the app + database + Redis are reachable; used by uptime monitors |

### 20.2 Sentry — Error Tracking

**What it is**: A service that automatically captures unhandled errors from your application, groups duplicate errors, and alerts you (Slack, email) when new error types appear or existing ones spike.

**What it gives us**:
- Every 500 error with full stack trace + request context
- Breadcrumbs (what happened before the error)
- Release tracking (did this deploy introduce a new error?)
- Performance monitoring (slow transactions)

### 20.3 Structured Logging

Instead of `console.log("payment failed for user 123")`, we log structured JSON:

```json
{
  "level": "error",
  "message": "Payment webhook verification failed",
  "requestId": "req_abc123",
  "operatorId": "op_xyz",
  "orderRef": "BB-2026-a3x7-k9m2",
  "provider": "momo",
  "reason": "amount_mismatch",
  "expected": 450000,
  "received": 400000,
  "timestamp": "2026-07-01T10:30:00Z"
}
```

**Why structured?** Searchable. You can query "show me all payment failures for MoMo in the last hour" instead of grep-ing through unformatted text.

### 20.4 Request ID Propagation

Every incoming request gets a unique ID (e.g., `req_abc123`). This ID is:
- Attached to every log line during that request
- Passed to every downstream call (database query, S3 upload, PSP call)
- Returned in the response header

When debugging "customer says their payment didn't work", you search for the request ID and see the entire chain: request received → hold validated → payment initiated → webhook received → error at step X.

### 20.5 Redaction List

The logger automatically strips sensitive fields from log output:
- Passwords, password hashes
- OTP codes
- JWT tokens, refresh tokens, OTP proof tokens
- Full phone numbers (logged as `+849xxx...xx`)
- Credit card numbers (never in our system, but defense-in-depth)
