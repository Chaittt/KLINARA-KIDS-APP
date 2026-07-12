import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from twilio_otp import generate_otp, normalize_phone, normalize_twilio_from_number, parent_phone_is_registered


def test_generate_otp_is_six_digits():
    otp = generate_otp()
    assert len(otp) == 6
    assert otp.isdigit()


def test_normalize_phone_adds_country_code():
    assert normalize_phone("9999999999") == "+919999999999"
    assert normalize_phone("+919999999999") == "+919999999999"
    assert normalize_phone("09999999999") == "+919999999999"


def test_parent_phone_is_registered_when_linked_to_account_or_student():
    assert parent_phone_is_registered(True, False)
    assert parent_phone_is_registered(False, True)
    assert not parent_phone_is_registered(False, False)


def test_normalize_twilio_from_number_requires_real_sender_id():
    assert normalize_twilio_from_number("+15551234567") == "+15551234567"
    assert normalize_twilio_from_number("15551234567") == "+15551234567"
    assert normalize_twilio_from_number("+") is None
