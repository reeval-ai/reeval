"""Bodies that would pass without running their calls: each fails its attempt instead, and calls
reeval refuses before they run."""

from __future__ import annotations

import time
from pathlib import Path

import pytest
from stdio_host import Host

EVAL = '''
import asyncio
from types import MappingProxyType
from reeval_python import evaluate


def hidden(fn):
    """A decorator without functools.wraps, so reeval can't see the body is a generator."""
    return lambda c: fn(c)


@evaluate("async generator body")
@hidden
async def agen(c):
    assert 1 == 2
    yield


@evaluate("sync generator body")
@hidden
def gen(c):
    assert 1 == 2
    yield


@evaluate("unawaited write_file")
async def unawaited_write(c):
    c.write_file("config.json", "{}")
    await c.exec("true")


@evaluate("unawaited send")
async def unawaited_send(c):
    c.send("do the task")


@evaluate("orphan task")
async def orphan(c):
    asyncio.get_running_loop().create_task(c.exec("false"))
    await asyncio.sleep(0)


@evaluate("orphan task exec after done")
async def orphan_exec(c):
    async def later():
        await asyncio.sleep(0.2)
        await c.exec("rm -rf build")

    asyncio.get_running_loop().create_task(later())


@evaluate("awaited task")
async def awaited_task(c):
    task = asyncio.get_running_loop().create_task(c.exec("true"))
    await asyncio.gather(task, c.exec("true"))


@evaluate("sync exec retries")
def sync_exec_retries(c):
    c.exec("npm test", retries=2, interval=0.25)


@evaluate("exec negative interval")
async def exec_negative_interval(c):
    await c.exec("npm test", retries=1, interval=-1)


@evaluate("exec env")
async def exec_env(c):
    await c.exec("npm test", env=MappingProxyType({"CI": "1"}))


@evaluate("exec env not strings")
def exec_env_not_strings(c):
    c.exec("npm test", env={"PORT": 3000})


'''


@pytest.fixture
def host(tmp_path: Path):  # pyright: ignore[reportUnknownParameterType]
    h = Host(tmp_path, EVAL)
    yield h
    h.kill()


@pytest.mark.parametrize("body", ["async generator body", "sync generator body"])
def test_a_generator_body_fails_rather_than_passing_unrun(host: Host, body: str) -> None:
    host.start(body)
    error = host.done()["error"]
    assert "generator, so it never ran" in error["message"], error
    assert host.calls() == []


@pytest.mark.parametrize(
    ("body", "call"), [("unawaited write_file", "c.write_file()"), ("unawaited send", "c.send()")]
)
def test_an_unawaited_call_fails_the_body(host: Host, body: str, call: str) -> None:
    host.start(body)
    error = host.done()["error"]
    assert error["message"].startswith(f"{call} was never awaited, so it didn't run"), error
    assert all(c["op"] not in ("writeFile", "send") for c in host.calls())
    assert "RuntimeWarning" not in host.stderr


def test_a_task_left_running_fails_the_body(host: Host) -> None:
    host.start("orphan task")
    error = host.done()["error"]
    assert "1 task(s) it started still running" in error["message"], error


def test_a_task_left_running_makes_no_call_after_done(host: Host) -> None:
    host.start("orphan task exec after done")
    assert "error" in host.done()
    seen = len(host.seen)
    time.sleep(0.5)
    assert [m for m in host.seen[seen:] if "call" in m] == []


def test_a_task_the_body_awaits_is_fine(host: Host) -> None:
    host.start("awaited task")
    assert host.done() == {"type": "done", "key": "k1"}


def test_exec_sends_retries_and_its_interval_in_seconds_as_ms(host: Host) -> None:
    host.start("sync exec retries")
    host.done()
    [run] = host.calls()
    assert run == {"op": "exec", "command": "npm test", "retries": 2, "interval": 250}


def test_exec_sends_its_env_as_a_plain_object(host: Host) -> None:
    host.start("exec env")
    host.done()
    [run] = host.calls()
    assert run == {"op": "exec", "command": "npm test", "env": {"CI": "1"}}


def test_exec_refuses_an_env_value_that_isnt_a_string_before_running(host: Host) -> None:
    host.start("exec env not strings")
    message = host.done()["error"]["message"]
    assert "c.exec(env=…) takes strings for names and values (got 'PORT': int)" in message
    assert host.calls() == []


def test_exec_refuses_a_negative_interval_before_running(host: Host) -> None:
    host.start("exec negative interval")
    message = host.done()["error"]["message"]
    assert "c.exec(interval=…) takes 0 or more seconds (got -1)" in message, message
    assert host.calls() == []
