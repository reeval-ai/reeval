"""What pyright tells an eval's author: a call an async body forgot to await, and a result field
reeval doesn't have."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SAMPLE = """
from reeval_python import AttemptContext, SyncAttemptContext, evaluate


@evaluate("sync")
def sync_body(c: SyncAttemptContext) -> None:
    result = c.exec("npm test")
    assert result.exit_code == 0
    assert c.read_file("ready.txt") == "ready"


@evaluate("async")
async def async_body(c: AttemptContext) -> None:
    result = await c.exec("npm test")
    assert result.ok
    c.write_file("x", "y")  # never awaited
    print(c.exec("npm test").exit_code)  # no exit_code
    assert result.succeeded  # no such field
"""


def test_pyright_finds_a_missing_await_and_an_unknown_field(tmp_path: Path) -> None:
    sample = tmp_path / "sample.eval.py"
    sample.write_text(SAMPLE)
    out = subprocess.run(
        [sys.executable, "-m", "pyright", "--outputjson", "--pythonpath", sys.executable, sample],
        capture_output=True,
        text=True,
        check=False,
    )
    report = json.loads(out.stdout)
    line = {n: i for i, text in enumerate(SAMPLE.splitlines()) for n in [text.split("# ")[-1]]}
    errors = sorted(
        (d["range"]["start"]["line"], d.get("rule", ""))
        for d in report["generalDiagnostics"]
        if d["severity"] == "error"
        and d.get("rule") in ("reportUnusedCoroutine", "reportAttributeAccessIssue")
    )
    assert errors == [
        (line["never awaited"], "reportUnusedCoroutine"),
        (line["no exit_code"], "reportAttributeAccessIssue"),
        (line["no such field"], "reportAttributeAccessIssue"),
    ], report["generalDiagnostics"]
    clean = [d for d in report["generalDiagnostics"] if d["range"]["start"]["line"] < errors[0][0]]
    assert clean == [], "the sync body and the awaited calls type-check"


MISUSE = """
from datetime import timedelta

from reeval_python import AttemptContext, Case, SyncAttemptContext, evaluate


@evaluate("ok", {"runs": 2, "timeout": timedelta(minutes=5), "judge": {"max_concurrent": 2}})
async def ok(c: AttemptContext) -> None:
    assert await c.read_file("x") == "y"


class Counted(Case):
    n: int


@evaluate("cases", {"cases": [Counted(key="1", n=1)]})
def ok_each(c: SyncAttemptContext, case: Counted) -> None: ...


@evaluate("wrong context")  # flagged
async def wrong_context(c: SyncAttemptContext) -> None: ...


@evaluate("sync generator")  # flagged
def sync_generator(c: SyncAttemptContext):
    yield


@evaluate("async generator")  # flagged
async def async_generator(c: AttemptContext):
    yield


@evaluate("returns a value")  # flagged
def returns_value(c: SyncAttemptContext) -> bool:
    return True


@evaluate("wrong cases", {"cases": [Case(key="1")]})  # flagged
async def wrong_each(c: SyncAttemptContext, case: Case) -> None: ...


@evaluate("misspelled option", {"runz": 3})  # flagged
def misspelled(c: SyncAttemptContext) -> None:
    c.exec("npm test", retries="2")  # flagged


@evaluate("misspelled judge option", {"judge": {"threshold": 0.5}})  # flagged
def misspelled_judge(c: SyncAttemptContext) -> None: ...
"""


def test_pyright_refuses_a_misdeclared_body_and_misspelled_options(tmp_path: Path) -> None:
    sample = tmp_path / "misuse.eval.py"
    sample.write_text(MISUSE)
    out = subprocess.run(
        [sys.executable, "-m", "pyright", "--outputjson", "--pythonpath", sys.executable, sample],
        capture_output=True,
        text=True,
        check=False,
    )
    report = json.loads(out.stdout)
    lines = MISUSE.splitlines()
    errors = {
        d["range"]["start"]["line"]
        for d in report["generalDiagnostics"]
        if d["severity"] == "error"
    }
    flagged = {i for i, text in enumerate(lines) if text.endswith("# flagged")}
    # pyright reports a refused decorator on the decorator's line or on the def below it.
    found = {i if i in flagged else i - 1 for i in errors}
    assert found == flagged, [
        (lines[d["range"]["start"]["line"]], d["message"]) for d in report["generalDiagnostics"]
    ]
