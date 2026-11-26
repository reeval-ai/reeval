"""Asserts through the runner: a plain `assert` keeps Python's semantics; what a failure says."""

from __future__ import annotations

import time
from pathlib import Path

from stdio_host import Host

EVALS = """
import asyncio
import contextvars
import threading
import time
from reeval_python import evaluate
from helper import must_be_even


@evaluate("awaits")
async def awaits(c):
    async def two():
        await asyncio.sleep(0)
        return 2
    assert await two() == 2
    assert await two() == 3, "two is three"


@evaluate("helper")
def helper(c):
    must_be_even(3)


@evaluate("retries")
def retries(c):
    for n in (1, 2):
        try:
            assert n == 2
            break
        except AssertionError:
            pass


@evaluate("message raises")
def message_raises(c):
    assert False, 1 / 0


@evaluate("after abort")
def after_abort(c):
    time.sleep(0.3)
    assert True


@evaluate("task group")
async def task_group(c):
    async def is_two(n):
        assert n == 2

    async with asyncio.TaskGroup() as tg:
        tg.create_task(is_two(1))
        tg.create_task(is_two(3))


@evaluate("task group with an error")
async def task_group_with_an_error(c):
    async def is_two(n):
        assert n == 2

    async def breaks():
        raise ValueError("broken")

    async with asyncio.TaskGroup() as tg:
        tg.create_task(is_two(1))
        tg.create_task(breaks())


@evaluate("chained")
def chained(c):
    try:
        assert 1 == 2
    except AssertionError as e:
        raise RuntimeError("wrapped") from e


@evaluate("fails after the abort")
async def fails_after_the_abort(c):
    try:
        await c.exec("sleep 20")
    except BaseException:
        pass
    assert 1 == 2


@evaluate("leaves a thread")
def leaves_a_thread(c):
    def late():
        time.sleep(0.3)
        assert True

    threading.Thread(target=contextvars.copy_context().run, args=(late,)).start()
"""

HELPER = """
def must_be_even(n):
    assert n % 2 == 0
"""


def _host(tmp_path: Path, **kwargs: bool) -> Host:
    (tmp_path / "helper.py").write_text(HELPER)
    return Host(tmp_path, EVALS, **kwargs)


def test_an_async_body_fails_with_its_asserts_message_and_traceback(tmp_path: Path) -> None:
    host = _host(tmp_path)
    try:
        host.start("awaits")
        error = host.done()["error"]
        assert error["name"] == "AssertionError"
        assert error["message"] == "two is three"
        stack = error["stack"].strip().splitlines()
        frames = [line for line in stack if line.lstrip().startswith("File ")]
        assert "x.eval.py" in frames[-1], stack
        assert stack[-1] == "AssertionError: two is three"
        assert host.calls() == []
    finally:
        host.kill()


def test_a_bare_assert_fails_with_its_statement(tmp_path: Path) -> None:
    host = _host(tmp_path)
    try:
        host.start("helper")
        assert host.done()["error"]["message"] == "assert n % 2 == 0"
    finally:
        host.kill()


def test_a_failure_the_body_catches_does_not_fail_it(tmp_path: Path) -> None:
    host = _host(tmp_path)
    try:
        host.start("retries")
        assert "error" not in host.done()
    finally:
        host.kill()


def test_an_assert_whose_message_raised_fails_with_that_error(tmp_path: Path) -> None:
    host = _host(tmp_path)
    try:
        host.start("message raises")
        assert host.done()["error"]["name"] == "ZeroDivisionError"
    finally:
        host.kill()


def test_an_aborted_body_sends_nothing_more(tmp_path: Path) -> None:
    host = _host(tmp_path)
    try:
        host.start("after abort")
        host.abort("k1")
        host.done()
        time.sleep(0.6)
        assert host.calls() == []
    finally:
        host.kill()


def test_an_eval_file_in_another_encoding_loads(tmp_path: Path) -> None:
    (tmp_path / "evals").mkdir()
    source = (
        "# -*- coding: latin-1 -*-\n"
        "from reeval_python import evaluate\n\n\n"
        '@evaluate("café")\n'
        "def cafe(c):\n"
        "    pass\n"
    )
    (tmp_path / "evals" / "latin.eval.py").write_bytes(source.encode("latin-1"))
    host = Host(tmp_path, "")
    try:
        host.send({"t": "collect", "file": "evals/latin.eval.py"})
        declared = host.wait(lambda m: m.get("file") == "evals/latin.eval.py")
        assert [n["name"] for n in declared["tree"]["children"]] == ["café"]
    finally:
        host.kill()


def test_a_task_group_of_failed_asserts_fails_with_each(tmp_path: Path) -> None:
    host = _host(tmp_path)
    try:
        host.start("task group")
        error = host.done()["error"]
        assert error["name"] == "AssertionError"
        assert error["message"] == "assert n == 2\nassert n == 2"
    finally:
        host.kill()


def test_a_task_group_with_an_error_fails_with_the_group(tmp_path: Path) -> None:
    host = _host(tmp_path)
    try:
        host.start("task group with an error")
        assert host.done()["error"]["name"] == "ExceptionGroup"
    finally:
        host.kill()


def test_an_error_raised_from_a_failed_assert_is_the_failure(tmp_path: Path) -> None:
    host = _host(tmp_path)
    try:
        host.start("chained")
        error = host.done()["error"]
        assert error["name"] == "RuntimeError"
        assert "AssertionError" in error["stack"]
    finally:
        host.kill()


def test_a_body_that_fails_after_its_abort_still_ends(tmp_path: Path) -> None:
    host = _host(tmp_path, answer=False)
    try:
        host.start("fails after the abort")
        host.wait(lambda m: m.get("call", {}).get("op") == "exec")
        host.abort("k1")
        assert host.done()["error"]["name"] == "AssertionError"
        assert "never retrieved" not in host.stderr
    finally:
        host.kill()


def test_a_thread_that_outlives_its_body_sends_nothing(tmp_path: Path) -> None:
    host = _host(tmp_path)
    try:
        host.start("leaves a thread")
        assert "error" not in host.done()
        time.sleep(0.6)
        assert host.calls() == []
    finally:
        host.kill()
