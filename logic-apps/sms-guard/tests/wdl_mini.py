"""A tiny evaluator for the subset of Logic Apps workflow-definition-language
expressions the SMS brand guard uses (concat, toLower, replace, contains, trim, if,
equals, empty, encodeUriComponent, variables, parameters). It exists so tests can run the generated
expression text itself against the contract vectors.

`ci=True` makes contains and replace case-insensitive. The guard lower-cases first and
only uses lower-case needles, so its result must not depend on that WDL detail: the
tests run every case in both modes.
"""
from __future__ import annotations

import re
import urllib.parse
from typing import Any


class WdlError(ValueError):
    pass


class _Parser:
    def __init__(self, src: str) -> None:
        self.s = src
        self.i = 0

    def peek(self) -> str:
        return self.s[self.i] if self.i < len(self.s) else ""

    def skip(self) -> None:
        while self.peek() in (" ", "\t", "\n", "\r"):
            self.i += 1

    def parse(self) -> Any:
        node = self.expr()
        self.skip()
        if self.i != len(self.s):
            raise WdlError(f"trailing text at {self.i}: {self.s[self.i:self.i + 40]!r}")
        return node

    def expr(self) -> Any:
        self.skip()
        if self.peek() == "'":
            return ("str", self.string())
        start = self.i
        while self.peek().isalnum() or self.peek() == "_":
            self.i += 1
        name = self.s[start:self.i]
        if not name:
            raise WdlError(f"unexpected {self.peek()!r} at {self.i}")
        self.skip()
        if self.peek() != "(":
            raise WdlError(f"{name} is not a call at {self.i}")
        self.i += 1
        args: list[Any] = []
        self.skip()
        if self.peek() == ")":
            self.i += 1
            return ("call", name, args)
        while True:
            args.append(self.expr())
            self.skip()
            c = self.peek()
            self.i += 1
            if c == ")":
                return ("call", name, args)
            if c != ",":
                raise WdlError(f"expected , or ) at {self.i - 1}")

    def string(self) -> str:
        self.i += 1
        out: list[str] = []
        while True:
            c = self.peek()
            if c == "":
                raise WdlError("unterminated string")
            self.i += 1
            if c == "'":
                if self.peek() == "'":
                    out.append("'")
                    self.i += 1
                    continue
                return "".join(out)
            out.append(c)


DEFAULT_PARAMETERS = {"SMS_BRAND_NAME": "Focus Hive"}  # the declared defaultValue


def evaluate(expr: str, variables: dict[str, str] | None = None, ci: bool = False,
             params: dict[str, str] | None = None) -> Any:
    tree = _Parser(expr).parse()
    return _eval(tree, variables or {}, ci, DEFAULT_PARAMETERS if params is None else params)


def _eval(node: Any, variables: dict[str, str], ci: bool, params: dict[str, str]) -> Any:
    if node[0] == "str":
        return node[1]
    _, name, raw = node
    if name == "if":  # lazy, like Logic Apps
        cond = _eval(raw[0], variables, ci, params)
        return _eval(raw[1] if cond else raw[2], variables, ci, params)
    args = [_eval(a, variables, ci, params) for a in raw]
    if name == "concat":
        return "".join(str(a) for a in args)
    if name == "toLower":
        return args[0].lower()
    if name == "trim":
        return args[0].strip()
    if name == "equals":
        return args[0] == args[1]
    if name == "empty":
        return len(args[0]) == 0
    if name == "variables":
        return variables[args[0]]
    if name == "parameters":
        return params[args[0]]
    if name == "encodeUriComponent":
        return urllib.parse.quote(args[0], safe="-_.!~*'()")
    if name == "replace":
        text, old, new = args
        if not old:
            raise WdlError("replace with an empty search string")
        if ci:
            return re.sub(re.escape(old), lambda _m: new, text, flags=re.IGNORECASE)
        return text.replace(old, new)
    if name == "contains":
        text, needle = args
        return needle.lower() in text.lower() if ci else needle in text
    raise WdlError(f"unsupported function {name}")


def literal(text: str) -> str:
    """A string as an expression literal."""
    return "'" + text.replace("'", "''") + "'"
