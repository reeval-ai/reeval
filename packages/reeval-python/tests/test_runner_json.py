"""NaN and Infinity aren't JSON: a value with one in it fails the call that passed it, rather
than reaching reeval as a message it can't read and leaving the call unanswered."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from stdio_host import Host

from reeval_python.wire import json_value

EVAL = """
from reeval_python import evaluate


@evaluate("nan observation")
async def nan_observation(c):
    await c.observe("score", float("nan"))


@evaluate("infinite state")
async def infinite_state(c):
    await c.decide({"score": float("inf")}, {"good": {"question": "is it good?"}})


@evaluate("nan sync observation")
def nan_sync_observation(c):
    c.observe("scores", [float("-inf")])
"""


def strict(line: str) -> Any:
    def refuse(constant: str) -> Any:
        raise ValueError(f"{constant} isn't JSON")

    return json.loads(line, parse_constant=refuse)


@pytest.fixture
def host(tmp_path: Path):  # pyright: ignore[reportUnknownParameterType]
    h = Host(tmp_path, EVAL)
    yield h
    h.kill()


@pytest.mark.parametrize(
    ("body", "says"),
    [
        ("nan observation", "c.observe('score', …) takes a JSON value"),
        ("infinite state", "c.decide()'s state is a string, a JSON object or parts"),
        ("nan sync observation", "c.observe('scores', …) takes a JSON value"),
    ],
)
def test_a_nan_or_infinity_fails_the_call_that_passed_it(host: Host, body: str, says: str) -> None:
    host.start(body)
    error = host.done()["error"]
    assert says in error["message"], error
    assert "NaN" in error["message"] or "nan" in error["message"] or "inf" in error["message"]
    assert host.calls() == []
    assert host.bad == []
    for message in host.raw:
        strict(message)


def test_a_nan_in_a_declaration_is_a_load_error(tmp_path: Path) -> None:
    source = 'from reeval_python import evaluate\n\n@evaluate("x", {"attempts": float("nan")})\n'
    source += "async def x(c):\n    pass\n"
    h = Host(tmp_path, source, collect=False)
    try:
        h.send({"t": "collect", "file": "evals/x.eval.py"})
        declared = h.wait(lambda m: m.get("t") in ("declared", "load-error"))
        assert declared["t"] == "load-error", declared
        assert "isn't JSON" in declared["error"]["message"], declared
        for message in h.raw:
            strict(message)
    finally:
        h.kill()


@pytest.mark.parametrize("value", [float("nan"), float("inf"), {"score": [float("-inf")]}])
def test_json_value_refuses_nan_and_infinity(value: Any) -> None:
    with pytest.raises(TypeError, match="^where: it isn't JSON, which has no NaN or Infinity$"):
        json_value(value, "where")


def test_json_value_names_a_cycle() -> None:
    cyclic: list[Any] = []
    cyclic.append(cyclic)
    with pytest.raises(TypeError, match="^where: it refers to itself, which JSON can't hold$"):
        json_value(cyclic, "where")
