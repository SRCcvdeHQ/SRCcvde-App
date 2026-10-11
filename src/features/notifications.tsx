import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { date } from "../shared/workspace";
import { Empty } from "../components/WorkspaceLayout";

export const PUSH_PUBLIC_KEY =
  "BL69KF1eYFXO1LSqLxw0Hp2gYCeJvobxGFN4cXC_h-Nx8hrnxTIadP6WUWfQVEPjmEgf1C-hEmFCCtJcNJHZugI";

export function pushKeyBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function pushKeyMatches(sub: PushSubscription) {
  const current = new Uint8Array(
    sub.options.applicationServerKey || new ArrayBuffer(0),
  );
  const expected = pushKeyBytes(PUSH_PUBLIC_KEY);
  return (
    current.length === expected.length &&
    current.every((byte, i) => byte === expected[i])
  );
}

export function NotificationsPage() {
  const defaults = {
    project_updates: true,
    documents: true,
    approvals: true,
    messages: true,
    billing: true,
    security: true,
    marketing: false,
  };
  const [prefs, setPrefs] = useState<Record<string, boolean>>(defaults),
    [loadingPrefs, setLoadingPrefs] = useState(true),
    [saving, setSaving] = useState(""),
    [notice, setNotice] = useState(""),
    [permission, setPermission] = useState<NotificationPermission>(
      typeof Notification === "undefined" ? "default" : Notification.permission,
    ),
    [requesting, setRequesting] = useState(false),
    [subscribed, setSubscribed] = useState(false),
    [devices, setDevices] = useState<any[]>([]),
    [isStaff, setIsStaff] = useState(false),
    [delivery, setDelivery] = useState({
      pending: 0,
      failed: 0,
      sent: 0,
      skipped: 0,
    }),
    [deliveryBusy, setDeliveryBusy] = useState(false);
  const supported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
  const categories = [
    [
      "project_updates",
      "Project updates",
      "Milestones, status changes, and project activity.",
    ],
    [
      "documents",
      "Documents & signatures",
      "Documents that need review, signature, or acknowledgment.",
    ],
    ["approvals", "Approvals", "Decisions and approvals waiting for you."],
    ["messages", "Messages", "New workspace messages and replies."],
    ["billing", "Billing", "Invoice and payment-status updates."],
    [
      "security",
      "Security & account",
      "Important account and security activity.",
    ],
    [
      "marketing",
      "Product news & marketing",
      "Optional SRCcvde product news. Off by default.",
    ],
  ];
  const loadDevices = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("push_subscriptions")
      .select("id,endpoint,user_agent,enabled,consented_at,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setDevices(data || []);
  };
  const loadDelivery = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase
      .from("app_memberships")
      .select("role,status")
      .eq("user_id", user.id)
      .maybeSingle();
    const staff = Boolean(
      m &&
      m.status === "active" &&
      ["owner", "admin", "staff"].includes(m.role),
    );
    setIsStaff(staff);
    if (!staff) return;
    const { data: jobs } = await supabase
      .from("notification_outbox")
      .select("status")
      .order("created_at", { ascending: false })
      .limit(200);
    const next = { pending: 0, failed: 0, sent: 0, skipped: 0 };
    (jobs || []).forEach((job: any) => {
      if (job.status in next) next[job.status as keyof typeof next]++;
    });
    setDelivery(next);
  };

  useEffect(() => {
    let alive = true;
    loadDelivery();
    loadDevices();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        if (alive) setLoadingPrefs(false);
        return;
      }
      const { data: p, error } = await supabase
        .from("notification_preferences")
        .select(
          "project_updates,documents,approvals,messages,billing,security,marketing",
        )
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (alive) {
        if (p) setPrefs({ ...defaults, ...p });
        if (error) setNotice("Could not load saved notification preferences.");
        setLoadingPrefs(false);
      }
      if (supported && Notification.permission === "granted") {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub && !pushKeyMatches(sub)) {
            await sub.unsubscribe();
            if (alive) setSubscribed(false);
          } else if (alive) setSubscribed(Boolean(sub));
        } catch {}
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  async function toggle(key: string) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(key);
    setNotice("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setNotice("Please sign in again.");
      setSaving("");
      return;
    }
    const { error } = await supabase.from("notification_preferences").upsert({
      user_id: user.id,
      ...next,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      setPrefs(prefs);
      setNotice("That preference could not be saved. Please try again.");
    } else setNotice("Preferences saved.");
    setSaving("");
  }
  async function retryFailed() {
    setDeliveryBusy(true);
    setNotice("");
    const { data, error } = await supabase.rpc("retry_failed_notifications");
    if (error) setNotice(error.message);
    else {
      await supabase.functions.invoke("dispatch-notifications");
      setNotice(
        (data || 0) +
          " failed notification" +
          (data === 1 ? "" : "s") +
          " queued for retry.",
      );
      await loadDelivery();
    }
    setDeliveryBusy(false);
  }
  async function sendTestNotification() {
    setRequesting(true);
    setNotice("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub)
        throw new Error(
          "This device does not have an active SRCcvde push subscription. Disable and re-enable notifications, then try again.",
        );
      const { data, error } = await supabase.functions.invoke(
        "send-push-notification",
        {
          body: {
            user_id: user.id,
            endpoint: sub.endpoint,
            category: "security",
            title: "SRCcvde notifications are live",
            body: "Your test notification arrived. Push is working on this device.",
            url: "/notifications",
            tag: "push-test-" + Date.now(),
          },
        },
      );
      if (error) throw error;
      const provider = data?.deliveries?.[0]?.provider;
      if (data?.sent > 0)
        setNotice(
          (provider === "apple"
            ? "Apple"
            : provider === "fcm"
              ? "Google Push"
              : "Push provider") +
            " accepted the test for this device. If no banner appears, refresh this device subscription and check iOS notification settings.",
        );
      else
        setNotice(
          data?.skipped === "preference_disabled"
            ? "Security notifications are disabled in your preferences."
            : "This device subscription was not accepted. Disable and re-enable notifications, then try again.",
        );
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "Could not send the test notification.",
      );
    } finally {
      setRequesting(false);
    }
  }
  async function disableThisDevice() {
    if (!supported) return;
    setRequesting(true);
    setNotice("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && sub) {
        await supabase
          .from("push_subscriptions")
          .update({ enabled: false, revoked_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
        await supabase.from("notification_consent_events").insert({
          user_id: user.id,
          action: "revoked",
          consent_text_version: "push-consent-2026-10-02-v1",
        });
      }
      setSubscribed(false);
      await loadDevices();
      setNotice(
        "Push notifications are disabled for this device. Other connected devices are unchanged.",
      );
    } catch {
      setNotice("Could not disable this device. Please try again.");
    } finally {
      setRequesting(false);
    }
  }
  async function requestPermission() {
    if (!supported) return;
    setRequesting(true);
    setNotice("");
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user)
        await supabase.from("notification_consent_events").insert({
          user_id: user.id,
          action: result === "granted" ? "granted" : "denied",
          consent_text_version: "push-consent-2026-10-02-v1",
        });
      if (result === "granted" && user) {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (sub && !pushKeyMatches(sub)) {
          await sub.unsubscribe();
          sub = null;
        }
        if (!sub)
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: pushKeyBytes(PUSH_PUBLIC_KEY),
          });
        const json = sub.toJSON();
        const { error: subError } = await supabase
          .from("push_subscriptions")
          .upsert(
            {
              user_id: user.id,
              endpoint: sub.endpoint,
              p256dh: json.keys?.p256dh || "",
              auth_key: json.keys?.auth || "",
              user_agent: navigator.userAgent,
              enabled: true,
              consented_at: new Date().toISOString(),
              revoked_at: null,
            },
            { onConflict: "endpoint" },
          );
        if (subError) throw subError;
        await supabase.functions.invoke("dispatch-notifications");
        setSubscribed(true);
        await loadDevices();
        setNotice(
          "Notifications are enabled on this device. Other devices on this account remain subscribed.",
        );
      } else
        setNotice(
          result === "denied"
            ? "Notifications are blocked for this site. You can change that in your device or browser settings."
            : "Notification permission was not enabled.",
        );
    } catch {
      setNotice("Could not request notification permission on this device.");
    } finally {
      setRequesting(false);
    }
  }
  async function revokeDevice(device: any) {
    setRequesting(true);
    setNotice("");
    try {
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ enabled: false, revoked_at: new Date().toISOString() })
        .eq("id", device.id);
      if (error) throw error;
      const reg = await navigator.serviceWorker.ready;
      const current = await reg.pushManager.getSubscription();
      if (current && current.endpoint === device.endpoint) {
        await current.unsubscribe();
        setSubscribed(false);
      }
      await loadDevices();
      setNotice("That device was disconnected from push notifications.");
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Could not disconnect that device.",
      );
    } finally {
      setRequesting(false);
    }
  }
  const deviceLabel = (ua: string) =>
    /iPhone/i.test(ua)
      ? "iPhone"
      : /iPad/i.test(ua)
        ? "iPad"
        : /Android/i.test(ua)
          ? "Android device"
          : /Chrome/i.test(ua) && /Macintosh/i.test(ua)
            ? "Chrome on Mac"
            : /Safari/i.test(ua) && /Macintosh/i.test(ua)
              ? "Safari on Mac"
              : /Windows/i.test(ua)
                ? "Windows device"
                : "Connected device";
  const state = !supported
    ? "Unsupported"
    : permission === "denied"
      ? "Blocked"
      : subscribed
        ? "Enabled"
        : "Disabled";
  return (
    <>
      <header className="page-title">
        <p className="eyebrow">Device preferences</p>
        <h1>Notifications</h1>
        <p>Choose how SRCcvde keeps you updated on this device.</p>
      </header>
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Permission</p>
            <h2>Push notifications</h2>
          </div>
          <span className="status-pill">{state}</span>
        </div>
        <p className="muted">
          Enable SRCcvde notifications on this device for project, document,
          approval, billing, message, and security updates. Notifications may
          appear on your lock screen depending on your device settings. You can
          change categories or disable notifications later.
        </p>
        {permission === "default" && supported && (
          <button
            className="primary"
            disabled={requesting}
            onClick={requestPermission}
          >
            {requesting ? "Requesting…" : "Enable notifications"}
          </button>
        )}
        {permission === "granted" && (
          <>
            <p className="muted">
              {subscribed
                ? "This device is subscribed and ready to receive SRCcvde push notifications."
                : "Notifications are off in SRCcvde. Your browser may still show notification permission as allowed; that permission is controlled by the browser/OS and does not mean SRCcvde is subscribed."}
            </p>
            <div className="detail-actions">
              <button
                className="primary"
                disabled={requesting}
                onClick={subscribed ? sendTestNotification : requestPermission}
              >
                {requesting
                  ? "Working…"
                  : subscribed
                    ? "Send test notification"
                    : "Enable notifications"}
              </button>
              {subscribed && (
                <button
                  className="secondary"
                  disabled={requesting}
                  onClick={disableThisDevice}
                >
                  {requesting ? "Updating…" : "Disable on this device"}
                </button>
              )}
            </div>
          </>
        )}
        {permission === "denied" && (
          <p className="muted">
            Your browser or device has blocked notifications. SRCcvde cannot
            override that choice.
          </p>
        )}
        {!supported && (
          <p className="muted">
            Push notifications are not available in this browser or app mode.
          </p>
        )}
      </section>
      <section className="panel notification-devices">
        <div className="section-head">
          <div>
            <p className="eyebrow">Connected devices</p>
            <h2>Where notifications can arrive</h2>
          </div>
          <span className="status">
            {devices.filter((d) => d.enabled).length} active
          </span>
        </div>
        <div className="notification-device-list">
          {devices.length ? (
            devices.map((d) => (
              <article className="notification-device" key={d.id}>
                <div>
                  <b>{deviceLabel(d.user_agent || "")}</b>
                  <small>
                    {d.enabled ? "Active" : "Disconnected"} ·{" "}
                    {d.consented_at
                      ? "Enabled " + date(d.consented_at)
                      : "Subscription saved"}
                  </small>
                </div>
                <div className="detail-actions">
                  {d.enabled ? (
                    <button
                      className="ghost"
                      disabled={requesting}
                      onClick={() => revokeDevice(d)}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <span className="pill archived">Disconnected</span>
                  )}
                </div>
              </article>
            ))
          ) : (
            <Empty>No notification devices are connected yet.</Empty>
          )}
        </div>
        <p className="muted">
          You can enable SRCcvde notifications on multiple phones, tablets, or
          computers. Each device keeps its own subscription.
        </p>
      </section>
      {isStaff && (
        <section className="panel notification-ops">
          <div className="section-head">
            <div>
              <p className="eyebrow">Delivery operations</p>
              <h2>Notification health</h2>
            </div>
            <span
              className={
                "attention-health " + (delivery.failed ? "needs-work" : "clear")
              }
            >
              {delivery.failed ? delivery.failed + " failed" : "Healthy"}
            </span>
          </div>
          <div className="notification-health-grid">
            <article>
              <small>Pending</small>
              <strong>{delivery.pending}</strong>
            </article>
            <article>
              <small>Failed</small>
              <strong>{delivery.failed}</strong>
            </article>
            <article>
              <small>Sent</small>
              <strong>{delivery.sent}</strong>
            </article>
            <article>
              <small>Skipped</small>
              <strong>{delivery.skipped}</strong>
            </article>
          </div>
          <p className="muted">
            This is the latest notification delivery window. Skipped usually
            means the recipient has no active device subscription or disabled
            that category.
          </p>
          {delivery.failed > 0 && (
            <button
              className="secondary"
              disabled={deliveryBusy}
              onClick={retryFailed}
            >
              {deliveryBusy ? "Retrying…" : "Retry failed notifications"}
            </button>
          )}
        </section>
      )}
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Preferences</p>
            <h2>What can notify you</h2>
          </div>
        </div>
        <div className="notification-preferences">
          {categories.map(([key, name, copy]) => (
            <label className="preference-row" key={key}>
              <span>
                <b>{name}</b>
                <small>{copy}</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(prefs[key])}
                disabled={loadingPrefs || saving === key}
                onChange={() => toggle(key)}
                aria-label={name}
              />
            </label>
          ))}
        </div>
        {notice && <p className="muted">{notice}</p>}
        <p className="muted">
          Marketing remains separate from operational notifications and is off
          by default.
        </p>
      </section>
    </>
  );
}
