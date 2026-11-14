"""Thin unittest wrappers so scripts/acceptance.py can map, admit and run the Vitest acceptance tests.

Each method runs the Vitest tests of one criterion (names `test_cN_...` in the *.test.ts files here) and fails if Vitest
fails or if it found no test. Criterion 10 (real devices) has no automated test. See INTERFACE.md.
"""
import os
import subprocess
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def run_vitest(n):
    cmd = ["npx", "vitest", "run", "--config", "tests/acceptance/vitest.config.ts", "-t", "test_c%d_" % n]
    p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, errors="replace", timeout=600)
    out = p.stdout + p.stderr
    if p.returncode != 0:
        lines = [ln for ln in out.splitlines() if "AssertionError" in ln or "Error" in ln or "FAIL" in ln]
        raise AssertionError("vitest criterion %d failed (exit %d): %s" % (n, p.returncode, " | ".join(lines[:3]) or out[-300:]))
    if "no tests" in out.lower():
        raise AssertionError("vitest found no test for criterion %d" % n)


class AccountsAndHouseholds(unittest.TestCase):
    def test_c1_signup_household_session(self):
        run_vitest(1)

    def test_c2_sessions_and_logout(self):
        run_vitest(2)

    def test_c3_generic_errors(self):
        run_vitest(3)

    def test_c4_lockout(self):
        run_vitest(4)

    def test_c5_invite_and_join(self):
        run_vitest(5)

    def test_c6_invalid_invites(self):
        run_vitest(6)

    def test_c7_password_reset(self):
        run_vitest(7)

    def test_c8_isolation(self):
        run_vitest(8)

    def test_c9_password_storage(self):
        run_vitest(9)


if __name__ == "__main__":
    unittest.main()
