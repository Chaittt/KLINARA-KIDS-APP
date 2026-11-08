"""Push notifications through Firebase Cloud Messaging (FCM).

Credentials are read from the environment, never from the repo:
  FIREBASE_SERVICE_ACCOUNT_JSON  - the full service account key JSON (one env var), or
  FIREBASE_SERVICE_ACCOUNT_FILE  - path to the key file (e.g. a Render Secret File)

If neither is set, push is disabled and every call is a harmless no-op.
"""
import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import List

import firebase_admin
from firebase_admin import credentials, messaging

log = logging.getLogger("klinara.push")

FCM_BATCH_SIZE = 500  # FCM limit per send_each call

_app = None
_init_tried = False


def _get_app():
    """Initialise the Firebase app once. Returns None if push is not configured."""
    global _app, _init_tried
    if _app is not None or _init_tried:
        return _app
    _init_tried = True

    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_FILE")
    try:
        if raw:
            # strict=False tolerates real newlines pasted inside the private_key string
            cred = credentials.Certificate(json.loads(raw, strict=False))
        elif path and os.path.exists(path):
            cred = credentials.Certificate(path)
        else:
            log.warning("Firebase credentials not set; push notifications are disabled")
            return None
        _app = firebase_admin.initialize_app(cred)
        log.info("Firebase push initialised")
    except Exception as e:
        log.error("Firebase init failed; push disabled: %s", e)
        _app = None
    return _app


async def save_token(db, user_id: str, platform: str, device_token: str) -> None:
    """Store a device token. A token belongs to one user: if someone else logs in on the
    same device, the token moves to them."""
    now = datetime.now(timezone.utc)
    await db.push_tokens.update_one(
        {"device_token": device_token},
        {
            "$set": {"user_id": user_id, "platform": platform, "updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )


async def send_push(db, recipients: List[str], data: dict) -> bool:
    """Send a notification to every registered Android device of the given user ids.

    `data` must contain "title" and "message"; "action_url" is optional.
    Returns True if at least one device accepted the notification, else False.
    iOS tokens are skipped for now (APNs tokens cannot be used with FCM directly).
    """
    recipients = [r for r in (recipients or []) if r]
    if not recipients or "title" not in data or "message" not in data:
        return False
    if _get_app() is None:
        return False

    docs = await db.push_tokens.find(
        {"user_id": {"$in": recipients}, "platform": "android"},
        {"_id": 0, "device_token": 1},
    ).to_list(5000)
    tokens = [d["device_token"] for d in docs if d.get("device_token")]
    if not tokens:
        return False

    delivered = 0
    action_url = str(data.get("action_url") or "")
    for i in range(0, len(tokens), FCM_BATCH_SIZE):
        chunk = tokens[i:i + FCM_BATCH_SIZE]
        messages = [
            messaging.Message(
                token=t,
                notification=messaging.Notification(title=str(data["title"]), body=str(data["message"])),
                data={"action_url": action_url},
                android=messaging.AndroidConfig(
                    priority="high",
                    # must match the channel created in the app (_layout.tsx)
                    notification=messaging.AndroidNotification(channel_id="default"),
                ),
            )
            for t in chunk
        ]
        try:
            # send_each is blocking, so run it off the event loop
            result = await asyncio.to_thread(messaging.send_each, messages, app=_app)
        except Exception as e:
            log.warning("FCM send failed (non-blocking): %s", e)
            continue

        delivered += sum(1 for r in result.responses if r.success)

        # Remove tokens FCM says are no longer valid (app uninstalled, token expired)
        dead = [
            chunk[j]
            for j, r in enumerate(result.responses)
            if not r.success
            and isinstance(r.exception, (messaging.UnregisteredError, messaging.SenderIdMismatchError))
        ]
        if dead:
            await db.push_tokens.delete_many({"device_token": {"$in": dead}})
            log.info("Removed %d invalid push tokens", len(dead))
        failed = sum(1 for r in result.responses if not r.success) - len(dead)
        if failed:
            log.warning("FCM: %d notifications failed (non-token errors)", failed)
    return delivered > 0
