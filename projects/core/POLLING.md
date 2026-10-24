# Demand-driven polling

`PollingService` is the single SDK scheduler for network polling. Merely calling
`watch` does nothing; subscribing registers demand. Always use
`takeUntilDestroyed` (or explicit teardown). The last unsubscribe removes the
resource, cancels its request and discards cached state. Keys describe a response
and all its parameters; never reuse a key for different response types or scopes.

```ts
polling.watch<Status>({
  key: `stream-status:${channelUuid}`,
  intervalMs: 5000,
  load: context => http.get<Status>(url, {context}),
}).pipe(takeUntilDestroyed()).subscribe(state => {
  // state.data retains the latest successful value when a later request fails.
  // state.error, state.loading and state.updatedAt describe its current status.
});
```

- Requests sharing a key share one cache and one in-flight request. The fastest
  active subscriber's interval wins. No resource overlaps its own requests.
- A single timeout schedules the next due resource(s). There are no per-page or
  per-resource interval timers. Authenticated requests with a `batch` descriptor
  are combined into `POST /api/poll` (up to 32 due resources per batch).
  Public anonymous and custom requests use their `load` callback instead.
  Existing endpoints remain available for one-off reads and writes.
- Only subscribed resources run. Counts belong to the header; inbox pages and
  the notification popover register lists only while mounted; monitoring only
  exists on its own page. Relay announcements share demand per channel.
- Hidden tabs suspend scheduling and cancel poll requests. Visibility recovery
  refreshes the registered resources. Public resources can run anonymously;
  `requiresSession: true` resources wait for a principal. Account changes cancel
  in-flight polls and clear state so cached private responses cannot cross users.
  The embedded lobby supplies an explicit token and manages host-presence demand
  through its setup/join lifecycle; this resource is not principal-gated.
- Initial loads and `polling.refresh(key)` use the normal loader. Automatic
  refreshes (including visibility recovery) set the established `SkipLoading`
  context. Load callbacks must pass this context to HttpClient. New subscriptions
  to already-cached resources do not create an artificial initial request.
- Failed loads keep the last good data, expose an error and back off to 2x, 4x,
  then 8x the requested interval. A successful response resets the backoff.
- Manual refresh queues once if a request is in flight. An unsubscribed key is
  never fetched just because `refresh(key)` was called.
- The global loader reference-counts normal requests. Token refresh shares one
  request across expired requests and inherits the originating SkipLoading flag.

Use the existing domain services (`RelayService`, `MessageService`,
`NotificationService`) where possible. Rendering, audio meter and device timers
are unrelated to HTTP polling and remain local.

The lobby's Live/Offline display currently depends on relay announcements; it
continues to register that specific channel. Host presence is needed only while
waiting to join, and stops once joined. No unrelated stream status is loaded by
visiting the lobby or admin dashboard.

## Batch resources

Add `batch: {resource: 'monitoring'}` (or another descriptor from `PollResource`)
to `watch`. The `load` callback remains the fallback for anonymous/custom polling.
The scheduler gathers only currently due, subscribed resources; success/error
handling and retry intervals remain independent per resource. If any item is an
initial/manual load, the batch uses the normal loader; all-background batches
use `SkipLoading`. Dropping one resource does not cancel a batch that another
resource still needs.

`PollResourceError` exposes `status` and a stable `code` for partial failures
inside HTTP 200 responses. Consumers can inspect `state.error` and choose their
own response (e.g. show a permissions error, retain a badge, or stop subscribing).
Missing/duplicate response IDs produce `INVALID_RESPONSE` only for the affected
resource. HTTP-level failures continue through the existing authentication and
error interceptors.

Supported descriptors: `messages-counts`, `notifications-counts`, `messages`
and `notifications` (with `offset`), `monitoring`, `stream-status` (with
`channelUuid`), and `host-presence` (with `channelUuid` and `streamUuid`).
Deploy/restart the server and update SDK/web client together when enabling batch
polling. No database migration is needed for the batch endpoint.
