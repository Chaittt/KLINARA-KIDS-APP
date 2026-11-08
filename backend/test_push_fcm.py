import asyncio
from types import SimpleNamespace
from unittest.mock import patch

import push_fcm
from firebase_admin import messaging


class FakeCursor:
    def __init__(self, docs): self.docs = docs
    async def to_list(self, n): return self.docs


class FakeTokens:
    def __init__(self): self.rows = {}
    async def update_one(self, flt, upd, upsert=False):
        tok = flt["device_token"]
        row = self.rows.setdefault(tok, {"device_token": tok})
        row.update(upd["$set"])
    def find(self, flt, proj=None):
        ids = flt["user_id"]["$in"]
        plat = flt["platform"]
        return FakeCursor([r for r in self.rows.values() if r["user_id"] in ids and r["platform"] == plat])
    async def delete_many(self, flt):
        for t in flt["device_token"]["$in"]:
            self.rows.pop(t, None)


class FakeDB:
    def __init__(self): self.push_tokens = FakeTokens()


def run(c): return asyncio.run(c)


def test_token_moves_to_latest_user():
    db = FakeDB()
    run(push_fcm.save_token(db, "u1", "android", "tokA"))
    run(push_fcm.save_token(db, "u2", "android", "tokA"))
    assert db.push_tokens.rows["tokA"]["user_id"] == "u2"
    assert len(db.push_tokens.rows) == 1


def test_noop_when_not_configured():
    db = FakeDB()
    run(push_fcm.save_token(db, "u1", "android", "tokA"))
    with patch.object(push_fcm, "_get_app", return_value=None), \
         patch.object(messaging, "send_each") as se:
        run(push_fcm.send_push(db, ["u1"], {"title": "t", "message": "m"}))
        se.assert_not_called()


def test_sends_only_android_and_cleans_dead_tokens():
    db = FakeDB()
    run(push_fcm.save_token(db, "u1", "android", "good"))
    run(push_fcm.save_token(db, "u1", "android", "dead"))
    run(push_fcm.save_token(db, "u1", "ios", "apns"))
    run(push_fcm.save_token(db, "u2", "android", "other-user"))

    ok = SimpleNamespace(success=True, exception=None)
    gone = SimpleNamespace(success=False, exception=messaging.UnregisteredError("gone"))
    sent = {}

    def fake_send_each(msgs, app=None):
        sent["tokens"] = [m.token for m in msgs]
        sent["body"] = msgs[0].notification.body
        sent["url"] = msgs[0].data["action_url"]
        return SimpleNamespace(responses=[gone if m.token == "dead" else ok for m in msgs])

    with patch.object(push_fcm, "_get_app", return_value=object()), \
         patch.object(messaging, "send_each", side_effect=fake_send_each):
        run(push_fcm.send_push(db, ["u1"], {"title": "T", "message": "Hello", "action_url": "/parent/activities"}))

    assert sorted(sent["tokens"]) == ["dead", "good"]      # no iOS, no other user
    assert sent["body"] == "Hello" and sent["url"] == "/parent/activities"
    assert "dead" not in db.push_tokens.rows               # cleaned up
    assert "good" in db.push_tokens.rows


def test_missing_title_or_message_is_ignored():
    db = FakeDB()
    run(push_fcm.save_token(db, "u1", "android", "tokA"))
    with patch.object(push_fcm, "_get_app", return_value=object()), \
         patch.object(messaging, "send_each") as se:
        run(push_fcm.send_push(db, ["u1"], {"title": "only title"}))
        se.assert_not_called()


def test_credentials_json_with_real_newlines_parses():
    import json
    raw = '{"a": "line1\nline2"}'
    assert json.loads(raw, strict=False)["a"] == "line1\nline2"
