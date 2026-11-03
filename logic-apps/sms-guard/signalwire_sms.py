#!/usr/bin/env python3
"""Replace a Logic App's Twilio SMS send with SignalWire (FocusApiary/infrastructure#414).

SignalWire serves Twilio's LaML REST API, so the send is a plain HTTP POST to
  https://<space>.signalwire.com/api/laml/2010-04-01/Accounts/<ProjectID>/Messages.json
with basic auth ProjectID:API-token.

Nothing sensitive is in the definition. At run time three HTTP actions read the
space name, project id and API token from Key Vault `omlab-secrets` with the
user-assigned managed identity `id-logicapps-signalwire`
(terraform/environments/tenants/focushive-privileged/logicapps_signalwire.tf).
Every action that sees a credential or a recipient has secure inputs and outputs
(the To and Body are inlined in the send action, because Compose cannot hide outputs),
so run history shows neither.

Brand signature (CEO mandate 2026-11-03, focushive#1): the message text inside the
send action is wrapped in a guard, a Logic Apps expression that appends "\\n- Focus Hive"
when the brand is missing. See "SMS brand signature" in README.md and
docs/sms-policy.md. The brand comes from SMS_BRAND_NAME (default "Focus Hive") when
the definitions are generated; the committed definitions are the default brand.

Action names must not end in token/secret/key/password: snapshot.py redacts a
runAfter list under such a key name.

The produced `Send_SMS` action is declared in the workflow's `managedActions`
(see estate.py): the repo owns that one action, and estate.py `apply` swaps it
into the live definition without touching anything else.

Usage:
  signalwire_sms.py migrate    workflows/<rg>/<workflow> [...]   one-off Twilio -> SignalWire migration
  signalwire_sms.py regenerate workflows/<rg>/<workflow> [...]   re-emit the guarded send body (idempotent)
  signalwire_sms.py guard-file <definition.json> [...]           guard every SMS send in any definition
                                                                 (SignalWire HTTP or Twilio connector shape),
                                                                 e.g. the ignite-curiosity copy
  signalwire_sms.py check      <definition.json> [...]           exit 1 when a send is unguarded or stale
`migrate` and `regenerate` take the path without the `.definition.json` / `.connections.json` suffix.
The committed definitions are generator output: change the guard here, never by hand.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

# VENDORED from FocusApiary/infrastructure (logicapps/estate/signalwire_sms.py); that repo is
# canonical, change the rule there and re-copy. The brand rule has one Python implementation (sms_brand.py);
# this generator takes the brand words from it and emits the same rule as a
# Logic Apps expression.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import sms_brand  # noqa: E402

VAULT = "https://omlab-secrets.vault.azure.net"
IDENTITY = ("/subscriptions/6e60a8fd-9992-4ff7-8a3e-db96b4dfed4f/resourceGroups/Om-Labs"
            "/providers/Microsoft.ManagedIdentity/userAssignedIdentities/id-logicapps-signalwire")
# The only SMS-capable SignalWire number in the project (verified through the
# LaML IncomingPhoneNumbers API on 2026-10-13). Not a secret: it was a literal in
# the Twilio actions too.
FROM_NUMBER = "+18045752622"
SECURE = {"secureData": {"properties": ["inputs", "outputs"]}}


def kv_get(secret: str) -> dict[str, Any]:
    return {"type": "Http", "runtimeConfiguration": SECURE, "runAfter": {},
            "inputs": {"method": "GET", "uri": f"{VAULT}/secrets/{secret}?api-version=7.4",
                       "authentication": {"type": "ManagedServiceIdentity", "identity": IDENTITY,
                                          "audience": "https://vault.azure.net"}}}


def as_expression(text: str) -> str:
    """An interpolated Logic Apps string ("+1@{variables('x')} text") as a bare
    expression (concat(...)) so it can sit inside another expression. Compose
    cannot hide its outputs, so recipients and message text never go through one."""
    parts: list[str] = []
    pos = 0
    while True:
        i = text.find("@{", pos)
        if i < 0:
            break
        j = text.find("}", i)
        if j < 0:
            raise ValueError(f"unterminated @{{ in {text!r}")
        if i > pos:
            parts.append("'" + text[pos:i].replace("'", "''") + "'")
        parts.append(text[i + 2:j])
        pos = j + 1
    if pos < len(text):
        parts.append("'" + text[pos:].replace("'", "''") + "'")
    return f"concat({', '.join(parts)})" if parts else "''"


# -- brand guard as a Logic Apps expression -----------------------------------------
#
# Logic Apps expressions have no regular expressions, so the contract pattern
#   (?<![A-Za-z0-9@./])focus[\s_.\-]*hive(?![A-Za-z0-9])(?!\.[A-Za-z])   (case-insensitive)
# is evaluated with toLower, replace and contains only (all of them case-sensitive
# or not, the text is lower-cased first, so it does not matter):
#   1. lower-case the text and collapse the separators between the brand words
#      (SEPARATORS) so "focus hive", "focus-hive", "focus.hive" ... all read "focushive";
#   2. destroy every occurrence whose preceding character is in LEFT_FORBIDDEN
#      (a destroyed occurrence keeps its first and last letter so its neighbours
#      still see the right context; the pass for the brand's last letter runs twice,
#      see below);
#   3. destroy every occurrence whose next character is in RIGHT_FORBIDDEN
#      (a letter or digit, or a dot followed by a letter);
#   4. the brand is present when "focushive" still occurs.
# If the brand is absent the text becomes trim(trim(text) + LF + "- " + Brand).
#
# Divergences from the regex (tests/test_sms_guard.py asserts they only ever make
# the guard APPEND, never skip a needed signature):
#   * a run of separators longer than the SEPARATORS forms (for example "focus -- hive",
#     or a NBSP) is not collapsed, so the brand reads as absent and the signature is appended;
#   * trim() also removes LEADING whitespace of a body that gets the signature
#     (the contract rstrips only the end);
#   * case folding is toLower (culture-invariant), the regex folds a few extra
#     non-ASCII characters (Kelvin sign, long s) onto ASCII letters.
# The expression is at most ~6 KB, the Logic Apps limit is 8,192 characters.

LF = "\n"
SEPARATORS = (" ", "_", ".", "-", "\n", "\r", "\t", "\r\n", "  ", " - ", " . ", "--")
LEFT_FORBIDDEN = tuple("abcdefghijklmnopqrstuvwxyz0123456789@./")
RIGHT_FORBIDDEN = (tuple("abcdefghijklmnopqrstuvwxyz0123456789")
                   + tuple("." + c for c in "abcdefghijklmnopqrstuvwxyz"))
EXPRESSION_LIMIT = 8192


def q(text: str) -> str:
    """A Logic Apps string literal ('' escapes a quote; nothing else is an escape)."""
    return "'" + text.replace("'", "''") + "'"


def _destroyed(token: str) -> str:
    """The token with its middle broken, first and last letter kept."""
    return token[0] + "#" + token[2:]


def guard_expression(expr: str, brand: str | None = None) -> str:
    """The bare expression (no leading @) that returns `expr` unchanged when the brand
    is present and the signed text otherwise. `expr` is itself a bare expression."""
    name = brand or sms_brand.brand_name()
    words = [w.lower() for w in name.split()]
    if not words:
        raise ValueError("brand name has no words")
    canon = "".join(words)
    broken = _destroyed(canon)
    norm = f"toLower({expr})"
    for left, right in zip(words, words[1:]):
        for sep in SEPARATORS:
            norm = f"replace({norm}, {q(left + sep + right)}, {q(left + right)})"
    # Matches do not overlap, so in a run of adjacent brands ("focushivefocushive...")
    # the pass for the brand's own last letter misses every other member; a second pass
    # catches the rest.
    for ch in LEFT_FORBIDDEN + (canon[-1],):
        norm = f"replace({norm}, {q(ch + canon)}, {q(ch + broken)})"
    for ch in RIGHT_FORBIDDEN:
        norm = f"replace({norm}, {q(canon + ch)}, {q(broken + ch)})"
    signed = f"trim(concat(trim({expr}), {q(sms_brand.SIGNATURE_PREFIX + name)}))"
    return f"if(contains({norm}, {q(canon)}), {expr}, {signed})"


def _split_args(text: str) -> list[str]:
    """Top-level comma-separated arguments of an expression call body, quote and bracket aware."""
    args: list[str] = []
    depth = 0
    in_str = False
    start = 0
    i = 0
    while i < len(text):
        c = text[i]
        if in_str:
            if c == "'":
                if text[i + 1:i + 2] == "'":
                    i += 1
                else:
                    in_str = False
        elif c == "'":
            in_str = True
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        elif c == "," and depth == 0:
            args.append(text[start:i].strip())
            start = i + 1
        i += 1
    args.append(text[start:].strip())
    return args


def split_guard(expr: str, brand: str | None = None) -> tuple[str, bool] | None:
    """If `expr` has the shape of the guard (whatever brand or generator version made it),
    (the text expression it wraps, whether it equals today's guard for that text); else None.
    Structural, so a stale guard is regenerated instead of being wrapped a second time."""
    if not (expr.startswith("if(contains(") and expr.endswith(")")):
        return None
    args = _split_args(expr[3:-1])
    if len(args) != 3 or not args[2].startswith("trim(concat(trim(") or not args[0].startswith("contains("):
        return None
    inner = args[1]
    return inner, guard_expression(inner, brand) == expr


FORM_BODY_MARK = "'&Body=', encodeUriComponent("


def guard_form(form: str, brand: str | None = None) -> str:
    """Re-emit a send form body `@concat('From=', ..., '&Body=', encodeUriComponent(<text>))`
    with <text> guarded. Idempotent: an already guarded text is regenerated."""
    if not form.startswith("@concat(") or not form.endswith("))") or FORM_BODY_MARK not in form:
        raise ValueError(f"not a SignalWire send form: {form[:80]!r}")
    cut = form.rindex(FORM_BODY_MARK) + len(FORM_BODY_MARK)
    text = form[cut:-2]
    split = split_guard(text, brand)
    return form[:cut] + guard_expression(text if split is None else split[0], brand) + "))"


def form_text(form: str, brand: str | None = None) -> tuple[str, bool]:
    """(the unguarded text expression of a send form, whether the form is guarded and current)."""
    cut = form.rindex(FORM_BODY_MARK) + len(FORM_BODY_MARK)
    text = form[cut:-2]
    split = split_guard(text, brand)
    return (text, False) if split is None else split


def _children(act: dict[str, Any]) -> list[dict[str, Any]]:
    """The action maps nested in a scope, condition, switch or loop action."""
    maps = [act.get("actions"), (act.get("else") or {}).get("actions"), (act.get("default") or {}).get("actions")]
    maps += [(case or {}).get("actions") for case in (act.get("cases") or {}).values()]
    return [m for m in maps if isinstance(m, dict)]


def send_actions(actions: dict[str, Any], path: str = "") -> list[tuple[str, dict[str, Any]]]:
    """Every action that posts an SMS: the SignalWire HTTP send (uri targets /Messages.json)
    or a Twilio connector ApiConnection (inputs.path is /Messages.json)."""
    found: list[tuple[str, dict[str, Any]]] = []
    for name, act in actions.items():
        if not isinstance(act, dict):
            continue
        inputs = act.get("inputs") if isinstance(act.get("inputs"), dict) else {}
        target = str(inputs.get("uri") or inputs.get("path") or "")
        if act.get("type") in ("Http", "ApiConnection") and "/Messages.json" in target:
            found.append((path + name, act))
        for child in _children(act):
            found.extend(send_actions(child, f"{path}{name}/"))
    return found


def guard_errors(definition: dict[str, Any], brand: str | None = None) -> list[str]:
    """Problems that mean an SMS can leave without the brand. Used by estate.py validate."""
    errors: list[str] = []
    for where, act in send_actions(definition.get("actions") or {}):
        inputs = act["inputs"]
        if act["type"] == "Http":
            form = inputs.get("body")
            if not isinstance(form, str) or not form.startswith("@concat(") or FORM_BODY_MARK not in form:
                errors.append(f"{where}: SMS send body is not the generated form (run signalwire_sms.py regenerate)")
            elif not form_text(form, brand)[1]:
                errors.append(f"{where}: SMS send has no current brand guard (run signalwire_sms.py regenerate)")
        else:
            text = (inputs.get("body") or {}).get("body") if isinstance(inputs.get("body"), dict) else None
            if not isinstance(text, str) or not text.startswith("@") or not (split_guard(text[1:], brand) or ("", False))[1]:
                errors.append(f"{where}: SMS send has no current brand guard (run signalwire_sms.py guard-file)")
        if len(json.dumps(inputs.get("body"))) > EXPRESSION_LIMIT - 200:
            errors.append(f"{where}: SMS send expression is close to the {EXPRESSION_LIMIT} character Logic Apps limit")
    return errors


def build_actions(to: str, body: str) -> dict[str, Any]:
    """Actions that send one SMS. `to` and `body` are the original Twilio action's
    strings, kept verbatim (they may contain @{...} interpolation). The body is wrapped
    in the brand guard."""
    creds = ("Get_SignalWire_Space", "Get_SignalWire_Project_ID", "Get_SignalWire_API_Credential")
    ready = {n: ["Succeeded"] for n in creds}
    form = ("@concat('From=', encodeUriComponent('" + FROM_NUMBER + "'), "
            f"'&To=', encodeUriComponent({as_expression(to)}), "
            f"{FORM_BODY_MARK}{guard_expression(as_expression(body))}))")
    return {
        "Get_SignalWire_Space": kv_get("signalwire-space-name"),
        "Get_SignalWire_Project_ID": kv_get("signalwire-project-id"),
        "Get_SignalWire_API_Credential": kv_get("signalwire-api-token"),
        "Send_SMS_via_SignalWire": {
            "type": "Http", "runAfter": ready, "runtimeConfiguration": SECURE,
            "inputs": {
                "method": "POST",
                "uri": "@concat('https://', body('Get_SignalWire_Space')?['value'], "
                       "'/api/laml/2010-04-01/Accounts/', body('Get_SignalWire_Project_ID')?['value'], '/Messages.json')",
                "headers": {"Content-Type": "application/x-www-form-urlencoded"},
                "body": form,
                # A retry after a lost response could text a learner twice.
                "retryPolicy": {"type": "none"},
                "authentication": {"type": "Basic",
                                   "username": "@body('Get_SignalWire_Project_ID')?['value']",
                                   "password": "@body('Get_SignalWire_API_Credential')?['value']"}}},
    }


def migrate(stem: Path) -> None:
    dpath = stem.with_name(stem.name + ".definition.json")
    cpath = stem.with_name(stem.name + ".connections.json")
    definition = json.loads(dpath.read_text())
    conns = json.loads(cpath.read_text())
    send = definition["actions"]["Send_SMS"]
    old = send["actions"]["Send_Text_Message_(SMS)"]
    body = old["inputs"]["body"]
    send["actions"] = build_actions(body["to"], body["body"])
    keys = [k for k, v in conns["$connections"].items() if v["connectionName"].lower().startswith("twilio")]
    if not keys:
        raise SystemExit(f"{stem}: no twilio connection key")
    for k in keys:
        del conns["$connections"][k]
    wf = conns["workflow"]
    wf["managedActions"] = sorted({*wf.get("managedActions", []), "Send_SMS"})
    wf["userAssignedIdentities"] = [IDENTITY]
    dpath.write_text(json.dumps(definition, indent=2) + "\n")
    cpath.write_text(json.dumps(conns, indent=2) + "\n")
    print(f"migrated {stem.parent.name}/{stem.name} (dropped {keys})")


def _swap_literal(text: str, old: str, new: str, where: str) -> str:
    """Replace the JSON string literal `old` with `new` in the file text, so only the
    guarded send body changes and the rest of the file keeps its exact formatting."""
    for ensure_ascii in (False, True):
        literal = json.dumps(old, ensure_ascii=ensure_ascii)
        if text.count(literal) >= 1:
            return text.replace(literal, json.dumps(new, ensure_ascii=ensure_ascii))
    raise SystemExit(f"{where}: cannot find the send body literal in the file text")


def guard_file(path: Path, brand: str | None = None) -> int:
    """Guard (or regenerate the guard of) every SMS send in a definition file. Returns
    the number of sends whose body changed."""
    text = path.read_text()
    sends = send_actions(json.loads(text).get("actions") or {})
    changed = 0
    for where, act in sends:
        inputs = act["inputs"]
        if act["type"] == "Http":
            old = inputs["body"]
            new = guard_form(old, brand)
        else:
            old = inputs["body"]["body"]
            raw = old[1:] if old.startswith("@") and not old.startswith("@{") else None
            split = split_guard(raw, brand) if raw is not None else None
            expr = split[0] if split else (raw if raw is not None else as_expression(old))
            new = "@" + guard_expression(expr, brand)
        if new != old:
            text = _swap_literal(text, old, new, f"{path}:{where}")
            changed += 1
    if changed:
        path.write_text(text)
    print(f"{path}: {len(sends)} SMS send(s), {changed} changed")
    return changed


def main(argv: list[str]) -> int:
    commands = ("migrate", "regenerate", "guard-file", "check")
    if len(argv) < 3 or argv[1] not in commands:
        print(__doc__, file=sys.stderr)
        return 2
    cmd, args = argv[1], argv[2:]
    if cmd == "migrate":
        for a in args:
            migrate(Path(a))
    elif cmd == "regenerate":
        for a in args:
            guard_file(Path(a + ".definition.json"))
    elif cmd == "guard-file":
        for a in args:
            guard_file(Path(a))
    else:
        problems = 0
        for a in args:
            for e in guard_errors(json.loads(Path(a).read_text())):
                print(f"{a}: {e}", file=sys.stderr)
                problems += 1
        return 1 if problems else 0
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
