---
name: slack-bolt-architecture
description: "Architectural standards for Slack Bolt applications: Socket Mode vs. HTTP transport selection, strict 3-second acknowledgment patterns, Events API retry deduplication (X-Slack-Retry-Num), Web API rate limiting governance across Tiers 1-4, HTTP 429 Retry-After handling with exponential backoff, and process resilience."
metadata:
  version: 1.0.0
---

# ⚙️ Slack Bolt Architecture, Event Resilience & Rate Limits

An engineering standard for architecting fault-tolerant Slack Bolt backends, navigating real-time transport models, enforcing event idempotency, and governing Web API rate limits.

---

## 🎯 Scope & Triggers

Activate this skill when:
- Bootstrapping a Slack application with Bolt for JavaScript/TypeScript or Bolt for Python.
- Choosing between **Socket Mode** (WebSocket) and **HTTP Request URLs** (Webhooks).
- Structuring action, command, and view submission handlers to satisfy Slack's **3-second acknowledgement deadline**.
- Implementing idempotent event processing to prevent duplicate reactions to Slack's automatic retries (`X-Slack-Retry-Num`).
- Handling Web API rate limits (`HTTP 429 Too Many Requests`) with exponential backoff, jitter, and circuit breakers across API Tiers 1–4.
- Hardening Bolt applications against process crashes and external Slack API outages.

---

## 1. Transport Architecture: Socket Mode vs. HTTP Endpoints

Slack provides two transport architectures for routing events and interactions to your backend:

```mermaid
flowchart LR
    subgraph Slack Cloud
        SlackEngine[Slack Event & Interaction Broker]
    end

    subgraph Socket Mode [Socket Mode (WebSockets)]
        ClientConn[Bolt App Process] -->|WSS Outbound Connection| SlackEngine
    end

    subgraph HTTP Mode [HTTP Webhooks (HTTPS)]
        SlackEngine -->|POST Inbound Webhook| PublicLB[Public Load Balancer / API Gateway]
        PublicLB --> Serverless[Bolt Service / Containers]
    end
```

### Decision Matrix

| Dimension | Socket Mode (`socketMode: true`) | HTTP Webhooks (`receiver: ExpressReceiver`) |
|---|---|---|
| **Inbound Ports** | **Zero open inbound ports** required | Requires public HTTPS URL (port 443) with valid TLS |
| **Firewall / NAT** | Operates cleanly behind corporate firewalls / VPNs | Requires public routing, static IP, or ngrok/tunneling |
| **Scaling Model** | Vertical scaling or sticky WS connections; bounded concurrency | Horizontal scaling; stateless auto-scaling (serverless, K8s) |
| **Token Requirement** | Requires an **App-Level Token** (`xapp-`) with `connections:write` | Only requires Bot Token (`xoxb-`) and Signing Secret |
| **Local Development** | Outstanding; run instantly on `localhost` without tunnels | Requires tunneling software (ngrok, cloudflared) |
| **Production Fit** | Internal tools, single-workspace apps, strictly firewalled servers | High-traffic B2B SaaS, multi-tenant marketplace apps |

---

## 2. The 3-Second Acknowledgment Rule & Async Offloading

Slack enforces an uncompromising **3-second timeout** on all incoming HTTP/WebSocket dispatches:
- If your server does not return HTTP 200 within 3,000ms, Slack marks the request as failed.
- In Events API, Slack triggers **automatic retries** (`X-Slack-Retry-Num`).
- In slash commands and shortcuts, the user receives an ugly error: *"Operation timed out"*.

### A. The Pure Acknowledgment Pattern

```typescript
// ❌ WRONG: Performing heavy database operations or external API calls before ack()
app.action("submit_review_action", async ({ ack, body }) => {
  await database.saveAuditTrail(body);   // Takes 1500ms
  await sendSalesforceSync(body);        // Takes 2200ms -> TIMEOUT!
  await ack();                           // Never reached within 3 seconds!
});

// ✅ CORRECT: Acknowledge immediately, offload work asynchronously
app.action("submit_review_action", async ({ ack, body, client }) => {
  // 1. Acknowledge within milliseconds
  await ack();

  // 2. Queue or execute work asynchronously in the background
  setImmediate(async () => {
    try {
      await database.saveAuditTrail(body);
      await sendSalesforceSync(body);
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: "Review submitted successfully!"
      });
    } catch (error) {
      console.error("Async task failed:", error);
    }
  });
});
```

---

## 3. Events API Retries & Idempotency Governance

When an HTTP endpoint times out or returns a non-200 code, Slack automatically resends the event up to **3 times** at exponential intervals.

Incoming retry requests include two headers:
- `X-Slack-Retry-Num`: An integer (e.g., `1`, `2`, `3`) indicating the attempt count.
- `X-Slack-Retry-Reason`: Explains why the retry occurred (e.g., `http_timeout`, `http_error`).

### A. Idempotent Deduplication Middleware
Every event in Slack carries a unique `event_id` in its payload. Use Redis or an atomic database transaction to prevent duplicate processing:

```typescript
import { Middleware, SlackEventMiddlewareArgs } from "@slack/bolt";

export const idempotentEventFilter = (redisClient: any): Middleware<SlackEventMiddlewareArgs> => {
  return async ({ payload, next }) => {
    const eventId = (payload as any).event_id;
    if (!eventId) {
      await next();
      return;
    }

    // Set NX with 30-minute expiration
    const isNew = await redisClient.set(`slack:event:${eventId}`, "processed", "EX", 1800, "NX");
    if (!isNew) {
      // Duplicate event detected from retry: exit silently
      return;
    }

    await next();
  };
};
```

---

## 4. Web API Rate Limit Governance (Tiers 1–4)

Slack restricts the frequency of Web API method invocations. Exceeding limits triggers an `HTTP 429 Too Many Requests` response containing a `Retry-After: <seconds>` header.

### A. Slack Rate Limit Tiers

| Tier | Sustained Limit | Common Methods in Tier |
|---|---|---|
| **Tier 1** | **1 request per minute** | `admin.conversations.bulkDelete`, heavy admin bulk operations |
| **Tier 2** | **20 requests per minute** | `conversations.history`, `users.list`, `team.info` |
| **Tier 3** | **50 requests per minute** | `chat.postMessage`, `chat.update`, `views.open`, `reactions.add` |
| **Tier 4** | **100+ requests per minute** | `conversations.replies`, `chat.postEphemeral` |

### B. Resilient Retry Strategy with Exponential Backoff
Bolt's built-in `WebClient` provides automated rate limit retries, but production systems must configure retry policies explicitly:

```typescript
import { WebClient, LogLevel } from "@slack/web-api";

export const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN, {
  logLevel: LogLevel.WARN,
  retryConfig: {
    retries: 5,                   // Maximum retry attempts
    factor: 2,                    // Exponential backoff factor (2, 4, 8, 16s...)
    minTimeout: 1000,             // Minimum wait time
    maxTimeout: 60000,            // Maximum wait cap (60s)
    randomize: true               // Add full jitter to prevent thundering herds
  }
});
```

### C. Bulk Channel Posting Strategy
When notifying hundreds of users (e.g., quorum reminders, poll nudges):
- **NEVER** fire concurrent `Promise.all([users.map(...)])`. You will instantly trip Tier 3 rate limits.
- **Batch and Throttle**: Process dispatches sequentially with a token bucket or queue (e.g., BullMQ) calibrated to $\le 40$ requests/minute for Tier 3 endpoints.

---

## 5. Process Resilience & Fault Isolation

An error during an API call for one workspace must **never** crash the entire application process.

### A. Localized Try/Catch Enclosure
```typescript
try {
  await client.chat.update({ channel, ts, blocks, text });
} catch (error: any) {
  if (error.data?.error === "message_not_found") {
    // Channel message was deleted by an admin; clean up local state
    await db.poll.update({ where: { id: pollId }, data: { isOrphaned: true } });
  } else if (error.data?.error === "is_archived") {
    // Channel was archived; suspend poll timers
    await db.poll.update({ where: { id: pollId }, data: { status: "SUSPENDED" } });
  } else {
    // Log error with workspace context without terminating the runtime
    logger.error("Failed to update message in Slack", { channel, ts, error: error.message });
  }
}
```

---

## 6. Architecture Quality Checklist

- [ ] **3-Second Ack Enforced**: All listener functions invoke `await ack()` prior to any long-running I/O.
- [ ] **Event Deduplication Active**: Handlers inspect `event_id` or `X-Slack-Retry-Num` to ensure idempotency.
- [ ] **Rate Limit Retries Configured**: WebClient includes exponential backoff with jitter and respects `Retry-After`.
- [ ] **No Process-Level Unhandled Rejections**: Slack API calls are wrapped in localized `try/catch` blocks.
- [ ] **Clean Shutdown Hooks**: App process handles `SIGTERM` and `SIGINT` to gracefully disconnect WebSocket or drain HTTP queues.
