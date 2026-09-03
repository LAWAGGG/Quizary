"""Email OTP for account verification.

Code is 6 digits, hashed with sha256 before hitting the DB (never stored
plaintext). Email is sent through stdlib smtplib; when SMTP_HOST is not
configured the code is logged instead (dev mode).

ponytail: in-memory resend cooldown, fine for single-process; per-account
accuracy across multiple workers would need a shared store.
"""
import hashlib
import hmac
import logging
import secrets
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import parseaddr

from app.config import (
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
)

logger = logging.getLogger("quizary")

OTP_TTL_MINUTES = 10
MAX_ATTEMPTS = 5

_RESEND_WINDOW_SECONDS = 60
_last_resend: dict[str, float] = {}


def _valid_sender(value: str) -> bool:
    """Return whether value is usable as an SMTP envelope/header sender."""
    _, address = parseaddr(value.strip())
    if not address or "@" not in address:
        return False
    local, domain = address.rsplit("@", 1)
    return bool(local and "." in domain and not domain.startswith("."))


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def verify_otp(code: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_otp(code), stored_hash)


def can_resend(email: str) -> bool:
    """True when enough time has passed since the last resend for this email."""
    now = time.monotonic()
    last = _last_resend.get(email)
    if last is None:
        _last_resend[email] = now
        return True
    if now - last >= _RESEND_WINDOW_SECONDS:
        _last_resend[email] = now
        return True
    return False


def _render(code: str) -> tuple[str, str]:
    text = (
        "Your Quizary verification code is "
        f"{code}.\n\nIt expires in {OTP_TTL_MINUTES} minutes. "
        "If you did not create this account, you can ignore this email."
    )
    html = f"""\
<p>Your Quizary verification code is</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{code}</p>
<p>It expires in {OTP_TTL_MINUTES} minutes. If you did not create this
account, you can ignore this email.</p>"""
    return text, html


def send_otp_email(to_email: str, code: str) -> None:
    """Send the OTP. Logs the code when SMTP is not configured (dev mode)."""
    if not SMTP_HOST:
        logger.info("[OTP dev mode] Code for %s: %s", to_email, code)
        print(f"[OTP dev mode] Code for {to_email}: {code}")
        return

    # Authenticated SMTP providers generally only permit a sender owned by
    # the authenticated account. Fall back to SMTP_USER when SMTP_FROM is
    # empty or malformed (for example, ``no-reply@Quizary``).
    sender = SMTP_FROM.strip() if SMTP_FROM else ""
    if not _valid_sender(sender):
        sender = SMTP_USER.strip() if SMTP_USER else ""
    if not _valid_sender(sender):
        raise RuntimeError(
            "SMTP_FROM must be a valid email address, or SMTP_USER must be set "
            "to a valid email address"
        )

    text, html = _render(code)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your Quizary verification code"
    msg["From"] = sender
    msg["To"] = to_email
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
        server.starttls()
        if SMTP_USER:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(sender, [to_email], msg.as_string())
