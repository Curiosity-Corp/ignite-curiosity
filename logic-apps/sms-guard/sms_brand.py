#!/usr/bin/env python3
"""SMS brand signature guard (CEO mandate 2026-11-03, focushive#1).

Rule: no SMS/MMS leaves any of our systems without the registered 10DLC brand
name. The brand is read from ONE setting, the environment variable
`SMS_BRAND_NAME` (default "Focus Hive"); nothing else may hard-code it.

guard(body) -> body
  1. The brand counts as present when this case-insensitive pattern matches
       (?<![A-Za-z0-9@./])focus[\\s_.\\-]*hive(?![A-Za-z0-9])(?!\\.[A-Za-z])
     (separators between the brand words are ignored; an e-mail address or URL
     host such as matthew@focushive.com is NOT the brand name). A non-default
     brand builds the same pattern from its words.
  2. Present: the body is returned unchanged, byte for byte.
  3. Absent: body.rstrip() + "\\n- " + Brand; an empty or whitespace-only body
     becomes "- " + Brand.
  4. The body is never truncated or altered otherwise; guard(guard(x)) == guard(x).
  5. Applies to EVERY message, including STOP/HELP/START auto-replies and
     human-typed texts.

Contract and vectors: sms-brand-vectors.json next to this file (every implementation must pass all cases).
VENDORED from FocusApiary/infrastructure scripts/signalwire/sms_brand.py (canonical; docs/sms-policy.md there).


CLI:
  sms_brand.py guard  [TEXT]   print the guarded text (stdin when TEXT is omitted)
  sms_brand.py check  [TEXT]   exit 0 when the brand is present, 1 when it is not
"""
from __future__ import annotations

import os
import re
import sys
from collections.abc import Mapping

ENV_VAR = "SMS_BRAND_NAME"
DEFAULT_BRAND = "Focus Hive"
SIGNATURE_PREFIX = "\n- "

_BEFORE = r"(?<![A-Za-z0-9@./])"
_BETWEEN = r"[\s_.\-]*"
_AFTER = r"(?![A-Za-z0-9])(?!\.[A-Za-z])"


def brand_name(env: Mapping[str, str] | None = None) -> str:
    """The configured brand. An unset or blank SMS_BRAND_NAME falls back to the
    default: the guard can never be switched off by emptying the setting."""
    source = os.environ if env is None else env
    value = " ".join((source.get(ENV_VAR) or "").split())
    return value or DEFAULT_BRAND


def presence_pattern(brand: str | None = None) -> re.Pattern[str]:
    words = (brand or brand_name()).split()
    if not words:
        raise ValueError("brand name has no words")
    body = _BETWEEN.join(re.escape(w.lower()) for w in words)
    return re.compile(_BEFORE + body + _AFTER, re.IGNORECASE)


def is_branded(body: str, brand: str | None = None) -> bool:
    return presence_pattern(brand).search(body) is not None


def guard(body: str, brand: str | None = None) -> str:
    name = brand or brand_name()
    if is_branded(body, name):
        return body
    stripped = body.rstrip()
    if not stripped:
        return "- " + name
    return stripped + SIGNATURE_PREFIX + name


# -- segment accounting (logging only; callers must still send the full body) ----

_GSM7_BASIC = (
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?"
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
)
_GSM7_EXTENDED = "\f^{}\\[~]|€"


def segment_count(body: str) -> tuple[str, int]:
    """("GSM-7" | "UCS-2", segments). GSM-7 is 160 / 153 per concatenated segment,
    UCS-2 is 70 / 67 (astral characters take two UCS-2 units)."""
    if all(c in _GSM7_BASIC or c in _GSM7_EXTENDED for c in body):
        units = sum(2 if c in _GSM7_EXTENDED else 1 for c in body)
        single, multi, label = 160, 153, "GSM-7"
    else:
        units = sum(2 if ord(c) > 0xFFFF else 1 for c in body)
        single, multi, label = 70, 67, "UCS-2"
    if units <= single:
        return label, 1
    return label, -(-units // multi)


def _main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] not in ("guard", "check"):
        print(__doc__, file=sys.stderr)
        return 2
    text = argv[2] if len(argv) > 2 else sys.stdin.read()
    if argv[1] == "check":
        return 0 if is_branded(text) else 1
    sys.stdout.write(guard(text))
    return 0


if __name__ == "__main__":
    sys.exit(_main(sys.argv))
