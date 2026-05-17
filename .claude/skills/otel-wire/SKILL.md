---
name: otel-wire
description: Wire OpenTelemetry traces + metrics + logs into a service with correlated IDs, sampled trace export, and a cost guardrail. Outputs to `docs/design/otel-<service>.md` + scaffold `instrumentation.ts`. Reads `/project-classify` to skip XS. Use when user says "otel", "OpenTelemetry", "tracing", "distributed tracing", "instrumentation", "/otel-wire", or before first incident where you wish you'd had traces.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 8h
  XL: 8h
---

# /otel-wire — OpenTelemetry Instrumentation

## Why you'd care

Without distributed tracing + correlated IDs, debugging a multi-service request means correlating timestamps by hand across five log streams. OTel wiring + cost guardrails make production introspection actually feasible.

Invoke as `/otel-wire`. Logs tell you what; metrics tell you how much; traces tell you why. Wire all three with a single correlated trace_id and a sampling strategy or you pay for petabytes.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. SLOs defined (so we know what to alert on).
3. Backend chosen (Tempo+Grafana / Honeycomb / Datadog / Jaeger / AWS X-Ray).

## Inputs
- Service name + version
- Runtime (Node, Python, Go, JVM)
- Backend / OTLP endpoint
- Sampling target (head-based %) and budget (events/month)

## Process

1. **SDK install** — Node example (others analogous):
   ```bash
   pnpm add @opentelemetry/api @opentelemetry/sdk-node \
     @opentelemetry/auto-instrumentations-node \
     @opentelemetry/exporter-trace-otlp-http \
     @opentelemetry/exporter-metrics-otlp-http \
     @opentelemetry/resources @opentelemetry/semantic-conventions
   ```

2. **Resource attributes** — set ONCE per process, immutable:

   | Attribute | Value | Why |
   |---|---|---|
   | `service.name` | `<api>` | groups all signals |
   | `service.version` | git SHA or semver | correlate with deploys |
   | `deployment.environment` | `prod` / `staging` / `dev` | filter |
   | `service.instance.id` | hostname / pod-name | per-replica |
   | `cloud.region` | `us-east-1` | regional drill-down |

3. **`instrumentation.ts` scaffold** (Node):
   ```ts
   import { NodeSDK } from '@opentelemetry/sdk-node'
   import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
   import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
   import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
   import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
   import { Resource } from '@opentelemetry/resources'
   import { SemanticResourceAttributes as A } from '@opentelemetry/semantic-conventions'
   import { TraceIdRatioBasedSampler, ParentBasedSampler } from '@opentelemetry/sdk-trace-base'

   export const sdk = new NodeSDK({
     resource: new Resource({
       [A.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME!,
       [A.SERVICE_VERSION]: process.env.GIT_SHA!,
       [A.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV!,
     }),
     sampler: new ParentBasedSampler({
       root: new TraceIdRatioBasedSampler(parseFloat(process.env.OTEL_SAMPLE_RATIO ?? '0.1')),
     }),
     traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }),
     metricReader: new PeriodicExportingMetricReader({
       exporter: new OTLPMetricExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }),
       exportIntervalMillis: 30_000,
     }),
     instrumentations: [getNodeAutoInstrumentations({
       '@opentelemetry/instrumentation-fs': { enabled: false }, // fs traces are noisy
     })],
   })
   sdk.start()
   ```
   Import this file FIRST in your entrypoint (before any HTTP client / DB client).

4. **Manual spans** — where auto-instrumentation isn't enough:

   | Span boundary | Why manual |
   |---|---|
   | Business operation (createOrder, sendInvoice) | name in trace = function name auto; explicit name = business event |
   | External call not covered by auto-instr | e.g., custom RPC, raw socket |
   | Slow path within a request | sub-spans show which step is slow |
   | Background job per message | not covered by auto-instr |

   ```ts
   import { trace } from '@opentelemetry/api'
   const tracer = trace.getTracer('checkout')
   await tracer.startActiveSpan('checkout.create_order', async (span) => {
     span.setAttribute('user.id', userId)
     span.setAttribute('order.total_cents', total)
     try { return await doWork() }
     catch (e) { span.recordException(e); span.setStatus({ code: 2 }); throw e }
     finally { span.end() }
   })
   ```

5. **Metric types** — pick deliberately:

   | Type | Use for | Example |
   |---|---|---|
   | Counter (monotonic) | totals (only goes up) | `requests_total`, `errors_total` |
   | UpDownCounter | inventory-like | `queue_depth`, `connections_open` |
   | Gauge (observable) | current value | `cpu_percent`, `cache_size_bytes` |
   | Histogram | distributions (p50/p95/p99) | `request_duration_ms` |

   Buckets for latency histograms: `[5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]` ms.

6. **Log correlation** — every log line gets trace_id + span_id:
   ```ts
   import { trace, context } from '@opentelemetry/api'
   function log(level: string, msg: string, fields = {}) {
     const ctx = trace.getSpanContext(context.active())
     console.log(JSON.stringify({
       level, msg, ts: new Date().toISOString(), ...fields,
       trace_id: ctx?.traceId, span_id: ctx?.spanId,
     }))
   }
   ```
   In logs backend, set `trace_id` as searchable field; one click → jump to trace.

7. **Sampling strategy**:

   | Strategy | When | Pros | Cons |
   |---|---|---|---|
   | Head-based 100% | dev, low traffic | full fidelity | $$$ at scale |
   | Head-based 10% | high-traffic prod | cheap | misses rare errors |
   | Tail-based (errors + slow) | best fidelity | catches outliers | needs collector |
   | Hybrid: 10% head + 100% errors | recommended | balanced | most setup |

   Always 100%-sample: 5xx responses, requests > 2× p95 SLO.

### Sampling-ratio self-tune

Default head-sampling ratio = 1.0 (100%) in dev, 0.1 (10%) in prod. Self-tune trigger conditions:

- **Trace volume > backend ingest budget** → halve ratio, observe error-trace capture rate.
- **Error-rate spike** → temporarily raise ratio to 1.0 for affected service for 1h (tail-based sampler preferred if backend supports — keeps all errors, samples successes).
- **Cost > budget** → drop healthy-path ratio to 0.01 (1%), keep `is_error=true` + slow (`duration_ms > p99`) at 1.0 via tail-based rule.
- **Audit / compliance period** → raise ratio to 1.0 on regulated services, document in `/audit-log-design`.

Re-evaluate quarterly. Record current ratio + rationale in `docs/otel/sampling-policy.md`.

Cross-ref: `/slo-design` (error-budget burn rate informs ratio), `/cost-finops` (ingest cost cap).

8. **Cost guardrails** — cardinality kills:
   - Never put `user_id` / `request_id` / `tenant_id` on metric labels (use on span attributes only)
   - Cap span attributes to <20 per span
   - Drop attributes from `http.target` (URL with IDs → `/users/:id`)
   - Set per-month event budget; alert when 80% consumed

9. **Anti-patterns**:
   - Importing instrumentation AFTER other modules — auto-instr misses them
   - High-cardinality metric labels (user IDs) — bill explodes
   - Logs without trace_id — no correlation
   - Sampling configured at backend only — span cost is already paid
   - No `recordException` on caught errors — span status stays OK

## Output

Write `docs/design/otel-<service>.md`:

```markdown
# OpenTelemetry — <service>
**Date:** <YYYY-MM-DD> | **Owner:** <team> | **Backend:** <Honeycomb / Tempo / Datadog>

## Resource attributes
| Key | Value |
|---|---|
| service.name | <api> |
| service.version | git SHA |
| deployment.environment | prod/staging |

## Auto-instrumentation
- HTTP server + client
- DB driver (pg / mysql2 / mongodb)
- Redis client
- Kafka / Rabbit (if used)
- Disabled: fs (noisy)

## Manual spans
| Boundary | Tracer | Attributes |
|---|---|---|
| checkout.create_order | checkout | user.id, order.total_cents |
| billing.charge_card | billing | invoice.id |
| email.send | email | template.name, recipient.domain |

## Metrics
| Name | Type | Buckets/Labels |
|---|---|---|
| http_server_duration_ms | Histogram | [5,10,25,...,5000] |
| http_server_requests_total | Counter | method, route, status_class |
| queue_depth | UpDownCounter | queue |

## Sampling
- Head-based: <10%>
- Always 100%: 5xx, latency > 2× p95
- Env: `OTEL_SAMPLE_RATIO`

## Cost guardrails
- No high-cardinality labels on metrics
- <20 attributes / span
- Monthly event budget: <N>
- 80% budget alert wired

## Log correlation
- All logs JSON with `trace_id` + `span_id`
- Backend: `trace_id` field indexed
```

## Verification
- `instrumentation.ts` imported FIRST in entrypoint.
- Resource attributes set per env (not hard-coded prod).
- Sampling configured at SDK, not at backend.
- Logs include trace_id + span_id.
- No user/tenant IDs on metric labels.
- Errors call `recordException` + set status.
- Cardinality budget set and alerted.
