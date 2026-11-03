"""The SMS brand guard (CEO mandate 2026-11-03) in logic-apps/focuspass-registration.definition.json.

The guard expression text in the committed definition is evaluated with wdl_mini and
checked against the contract vectors; the definition must be generator output.

Run: cd logic-apps/sms-guard/tests && python3 -m unittest -v
"""
from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
GUARD = HERE.parent
DEFINITION = GUARD.parent / "focuspass-registration.definition.json"
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(GUARD))

import signalwire_sms as gen  # noqa: E402
import sms_brand  # noqa: E402
import wdl_mini  # noqa: E402

VECTORS = json.loads((GUARD / "sms-brand-vectors.json").read_text())


class Vectors(unittest.TestCase):
    def test_contract_pattern(self) -> None:
        self.assertEqual(sms_brand.presence_pattern().pattern, VECTORS["presence_regex_python"])

    def test_every_vector_in_both_case_modes(self) -> None:
        for ci in (False, True):
            for case in VECTORS["cases"]:
                with self.subTest(case=case["name"], ci=ci):
                    got = wdl_mini.evaluate(gen.guard_expression(wdl_mini.literal(case["body"])), ci=ci)
                    self.assertEqual(got, case["expected"])

    def test_python_reference_passes_every_vector(self) -> None:
        for case in VECTORS["cases"]:
            with self.subTest(case=case["name"]):
                self.assertEqual(sms_brand.guard(case["body"]), case["expected"])


class Definition(unittest.TestCase):
    def sends(self) -> list[tuple[str, dict]]:
        found = gen.send_actions(json.loads(DEFINITION.read_text()).get("actions") or {})
        self.assertEqual(len(found), 1)
        return found

    def test_every_send_is_guarded_and_current(self) -> None:
        self.sends()
        self.assertEqual(gen.guard_errors(json.loads(DEFINITION.read_text())), [])

    def test_gate_marker_and_brand_parameter(self) -> None:
        """launch-sequence sms-brand-gate: the marker in the send action description and
        SMS_BRAND_NAME on another line of the file (the declared workflow parameter)."""
        definition = json.loads(DEFINITION.read_text())
        self.assertEqual(definition["parameters"]["SMS_BRAND_NAME"], {"type": "String", "defaultValue": "Focus Hive"})
        for _, act in self.sends():
            self.assertIn(gen.MARKER, act["description"])
        lines = DEFINITION.read_text().splitlines()
        marker = [i for i, line in enumerate(lines) if gen.MARKER in line]
        other = [i for i, line in enumerate(lines) if "SMS_BRAND_NAME" in line and i not in marker]
        self.assertTrue(marker and other)

    def test_signature_reads_the_parameter_and_a_blank_one_falls_back(self) -> None:
        expr = gen.guard_expression(wdl_mini.literal("Hi! Check your email."))
        self.assertEqual(wdl_mini.evaluate(expr, params={"SMS_BRAND_NAME": "Acme"}), "Hi! Check your email.\n- Acme")
        self.assertEqual(wdl_mini.evaluate(expr, params={"SMS_BRAND_NAME": "  "}), "Hi! Check your email.\n- Focus Hive")

    def test_guarded_text_is_unchanged_because_it_names_the_brand(self) -> None:
        for _, act in self.sends():
            expr = act["inputs"]["body"]["body"]
            self.assertTrue(expr.startswith("@"))
            self.assertEqual(
                wdl_mini.evaluate(expr[1:]),
                "Hi! This is Marisa from Focus Hive. You are now signed up to our Curiosity Community.\n"
                "Check your email for your login details! Don't forget to check your Spam folder, too! :)",
            )

    def test_text_without_the_brand_would_be_signed(self) -> None:
        for _, act in self.sends():
            self.assertIsNotNone(gen.split_guard(act["inputs"]["body"]["body"][1:]))
            swapped = gen.guard_expression(wdl_mini.literal("Hi! Check your email."))
            self.assertEqual(wdl_mini.evaluate(swapped), "Hi! Check your email.\n- Focus Hive")

    def test_regenerating_changes_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            copy = Path(tmp) / "definition.json"
            shutil.copyfile(DEFINITION, copy)
            self.assertEqual(gen.guard_file(copy), 0)
            self.assertEqual(copy.read_text(), DEFINITION.read_text())


if __name__ == "__main__":
    unittest.main()
