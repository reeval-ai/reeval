"""The runner's trials, with the test as reeval: keys, aborts and the calls bodies make."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import pytest
from stdio_host import Host

EVALS = """
import time
from reeval_python import EvalError, evaluate


@evaluate("sleeps then calls")
def sleeps_then_calls(c):
    time.sleep(0.3)
    c.exec("echo after-abort")


@evaluate("calls")
def calls(c):
    time.sleep(0.5)
    c.exec("echo calls")


@evaluate("assert stops")
def assert_stops(c):
    assert c.exec("echo first").ok
    assert c.exec("false").ok, "builds"
    c.exec("echo never")


@evaluate("raises an EvalError")
def raises_an_eval_error(c):
    r = c.exec("false")
    try:
        raise OSError("no such file")
    except OSError as exc:
        raise EvalError("the build fails", meta={"exit_code": r.exit_code}) from exc


@evaluate("writes bytes")
async def writes_bytes(c):
    await c.write_file("data.bin", bytes([0, 1]))
"""


@pytest.fixture
def host(tmp_path: Path):
    h = Host(tmp_path, EVALS)
    yield h
    h.kill()


def test_two_bodies_on_one_trial_id_keep_their_own_calls(host: Host) -> None:
    host.start("sleeps then calls", "k1")
    host.start("calls", "k2")
    host.done("k1")
    host.done("k2")
    assert host.calls("k1") == [{"op": "exec", "command": "echo after-abort"}]
    assert host.calls("k2") == [{"op": "exec", "command": "echo calls"}]


def test_an_abort_stops_only_the_body_it_names(host: Host) -> None:
    host.start("sleeps then calls", "k1")
    host.start("calls", "k2")
    host.abort("k1", "canceled", "x")
    assert "error" not in host.done("k2")
    assert host.done("k1")["error"] == {"name": "AbortError", "message": "x"}


def test_an_aborted_sync_body_makes_no_more_calls(host: Host) -> None:
    host.start("sleeps then calls", "k1")
    time.sleep(0.05)
    host.abort("k1")
    assert host.done("k1")["error"] == {"name": "TimeoutError", "message": "late"}
    time.sleep(0.6)
    assert host.calls("k1") == [], "the body's thread called reeval after the abort"


def test_bytes_go_as_base64(host: Host) -> None:
    host.start("writes bytes")
    assert "error" not in host.done()
    assert host.calls() == [
        {"op": "writeFile", "path": "data.bin", "contents": "AAE=", "encoding": "base64"},
    ]


def test_a_body_the_runner_cancels_without_an_abort_ends_with_an_error() -> None:
    from reeval_python.runner import (
        _canceled_done,  # pyright: ignore[reportPrivateUsage]
        _Connection,  # pyright: ignore[reportPrivateUsage]
    )

    written: list[dict[str, Any]] = []

    class Frames:
        def write(self, msg: dict[str, Any]) -> None:
            written.append(msg)

    conn = _Connection(Frames())  # type: ignore[arg-type]
    _canceled_done(conn, "k1")
    conn.abort("k2", "TimeoutError", "Eval timed out after 1s")
    _canceled_done(conn, "k2")
    assert written == [
        {
            "type": "done",
            "key": "k1",
            "error": {
                "name": "RunnerError",
                "message": "the runner stopped this body without reeval aborting it",
            },
        },
        {
            "type": "done",
            "key": "k2",
            "error": {"name": "TimeoutError", "message": "Eval timed out after 1s"},
        },
    ]


def test_a_failed_assert_ends_the_body_with_its_message(host: Host) -> None:
    host.start("assert stops")
    error = host.done()["error"]
    assert (error["name"], error["message"]) == ("AssertionError", "builds")
    commands = [c.get("command") for c in host.calls() if c["op"] == "exec"]
    assert commands == ["echo first", "false"]


def test_an_eval_error_ends_the_body_with_its_reason_and_meta(host: Host) -> None:
    host.start("raises an EvalError")
    error = host.done()["error"]
    assert (error["name"], error["message"], error["meta"]) == (
        "EvalError",
        "the build fails",
        {"exit_code": 1},
    )
    assert "OSError: no such file" in error["stack"]


def test_an_eval_error_takes_a_reason_and_json_meta() -> None:
    from reeval_python import EvalError

    assert EvalError("the build fails").meta is None
    with pytest.raises(TypeError, match="takes a reason"):
        EvalError("  ")
    with pytest.raises(TypeError, match="takes JSON"):
        EvalError("x", meta={"at": object()})
