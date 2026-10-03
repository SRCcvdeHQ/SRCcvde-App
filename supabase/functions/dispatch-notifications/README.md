// Production source is deployed as dispatch-notifications v1.
// Authenticates an active workspace member, drains server-generated notification_outbox rows,
// respects per-user category preferences, sends to every enabled device subscription,
// disables expired endpoints, and records sent/skipped/failed delivery state.
// Runtime secrets: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (never commit the private value).
