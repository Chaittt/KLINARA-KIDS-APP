import logging
import os
from typing import Optional

import requests

log = logging.getLogger("klinara.twilio")

VERIFY_BASE_URL = "https://verify.twilio.com/v2"


def normalize_phone(phone: str) -> str:
    """Convert local Indian numbers to E.164 (+91...) format. Leaves already-international numbers untouched."""
    phone = (phone or "").strip()
    if not phone:
        return phone
    if phone.startswith("+"):
        return phone
    if phone.startswith("00"):
        return f"+{phone[2:]}"
    if phone.startswith("0") and len(phone) == 11:
        return f"+91{phone[1:]}"
    if len(phone) == 10 and phone.isdigit():
        return f"+91{phone}"
    return f"+{phone}"


def parent_phone_is_registered(has_parent_account: bool, has_linked_student: bool) -> bool:
    return has_parent_account or has_linked_student


def twilio_verify_configured() -> bool:
    return bool(
        os.getenv("TWILIO_ACCOUNT_SID")
        and os.getenv("TWILIO_AUTH_TOKEN")
        and os.getenv("TWILIO_VERIFY_SERVICE_SID")
    )


def start_verification(phone: str) -> bool:
    """Ask Twilio Verify to send an OTP via SMS. Returns True if the request was accepted."""
    e164_phone = normalize_phone(phone)

    if os.getenv("MOCK_OTP"):
        log.info("[MOCK OTP] Skipping real Twilio Verify send for %s", e164_phone)
        return True

    if not twilio_verify_configured():
        log.warning("Twilio Verify not configured; cannot send OTP to %s", e164_phone)
        return False

    sid = os.environ["TWILIO_ACCOUNT_SID"]
    token = os.environ["TWILIO_AUTH_TOKEN"]
    service_sid = os.environ["TWILIO_VERIFY_SERVICE_SID"]

    try:
        response = requests.post(
            f"{VERIFY_BASE_URL}/Services/{service_sid}/Verifications",
            data={"To": e164_phone, "Channel": "sms"},
            auth=(sid, token),
            timeout=10,
        )
        response.raise_for_status()
        status = response.json().get("status")
        log.info("Twilio Verify started for %s, status=%s", e164_phone, status)
        return True
    except Exception as exc:  # pragma: no cover - network path
        log.warning("Twilio Verify send failed for %s: %s", e164_phone, exc)
        return False


def check_verification(phone: str, code: str) -> bool:
    """Check the code the parent entered against Twilio Verify. Returns True only if approved."""
    e164_phone = normalize_phone(phone)

    if os.getenv("MOCK_OTP"):
        approved = code.strip() == os.environ["MOCK_OTP"]
        log.info("[MOCK OTP] Check for %s: %s", e164_phone, approved)
        return approved

    if not twilio_verify_configured():
        log.warning("Twilio Verify not configured; cannot check OTP for %s", e164_phone)
        return False

    sid = os.environ["TWILIO_ACCOUNT_SID"]
    token = os.environ["TWILIO_AUTH_TOKEN"]
    service_sid = os.environ["TWILIO_VERIFY_SERVICE_SID"]

    try:
        response = requests.post(
            f"{VERIFY_BASE_URL}/Services/{service_sid}/VerificationCheck",
            data={"To": e164_phone, "Code": code.strip()},
            auth=(sid, token),
            timeout=10,
        )
        # Twilio returns 404 if there's no pending verification (e.g. already used/expired) -
        # that's a normal "invalid" outcome, not a crash, so don't raise_for_status blindly.
        if response.status_code == 404:
            log.info("Twilio Verify: no pending verification for %s", e164_phone)
            return False
        response.raise_for_status()
        status = response.json().get("status")
        log.info("Twilio Verify check for %s, status=%s", e164_phone, status)
        return status == "approved"
    except Exception as exc:  # pragma: no cover - network path
        log.warning("Twilio Verify check error for %s: %s", e164_phone, exc)
        return False
