"""Typed options for `evaluate` and `group`, with reeval's keys in snake_case.

A duration (`timeout`) is seconds or a `timedelta`. The values nested inside an option are the
data reeval documents for it, in snake_case too, and reeval checks them when it plans the run.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import timedelta
from typing import Any, Generic, Literal, Required, TypedDict, TypeVar

from reeval_python._wire import BuiltinGraderData as BuiltinGrader
from reeval_python.environment import (
    DockerSandbox,
    Environment,
    FakeHarness,
    FakeJudge,
    TartSandbox,
)
from reeval_python.target import Target

Harness = str | FakeHarness | Mapping[str, Any]
T = TypeVar("T")


class JudgeDefaults(TypedDict, total=False):
    """The judge's model and settings, merged field by field down the cascade."""

    gateway: Literal["direct", "vercel", "openrouter"] | Mapping[str, Any]
    max_concurrent: int
    model: str | FakeJudge
    provider_options: Mapping[str, Mapping[str, Any]]


class BestOf(TypedDict):
    """`runs={"best_of": 5}`: stop each cell once a majority of its 5 attempts agree."""

    best_of: int
    """Odd, 3 or more."""


class EvalOptions(TypedDict, total=False):
    """Options for an eval or a group; a group's cascade to the evals inside it."""

    capture: Mapping[str, Any]
    compare: Mapping[str, Any]
    egress: Literal["allow-all", "deny-all", "proxy"] | Mapping[str, Any]
    """A policy (`"proxy"`, `"allow-all"`, `"deny-all"` or `{"allow": [hosts]}`), or one per
    phase: `{"setup": "allow-all", "agent": "deny-all"}`."""
    env: Mapping[str, Any]
    environments: Environment | Sequence[Environment] | Mapping[str, Any]
    """One environment, or a list, each its own cell beside each harness; `{"add": …}` and
    `{"only": [names]}` edit the inherited list."""
    agents: Harness | Sequence[Harness] | Mapping[str, Any]
    graders: Sequence[BuiltinGrader]
    """Built-in graders as data, each `{"builtin": kind, "args": […]}` with `name`, `weight` or
    `required`, e.g. `{"builtin": "used-skill", "args": ["http-retries"], "weight": 2}`; a
    regular expression argument is `{"regexp": …, "flags": …}`. Per eval only."""
    judge: JudgeDefaults
    pin: Sequence[str]
    question: Mapping[str, Any]
    questions: Sequence[Mapping[str, Any]]
    """Asked of each attempt, or between attempts with `across`; `[]` clears the group's. Each
    names what it's shown: `{"question": …, "diff": True}`, at least one input."""
    sandbox: DockerSandbox | TartSandbox | Mapping[str, Any]
    snapshot: bool | Literal["turns"] | Mapping[str, Any]
    """When each attempt's workspace is copied into its directory in `.reeval/runs`: `True` after
    the checks, `"turns"` after each `send` too, `False` never, or `{"when": …, "compress": True}`
    for `<name>.tar.gz` files. Default `True`."""
    revision: int | str
    """The eval's version, in its fingerprint: bump it when a helper, a constant outside the body
    or a fixture changes what it measures. A group's applies to evals inside that set none."""
    runs: int | BestOf
    """Attempts per cell, or `{"best_of": n}`, which stops each cell once a majority of its
    attempts agree. Not on a compared eval."""
    tags: Sequence[str]
    target: Target
    """Whether the eval passes and can fail the run, over its attempts' scores: `metric(…)`,
    `regression(…)` or `capability(…)`; default `metric()`, which only reports. On a compare it
    applies to the variants."""
    timeout: timedelta | float
    """Per attempt, in seconds or as a timedelta."""


class Case(TypedDict):
    """One case of an eval with `cases`; subclass it for the case's own fields:
    `class Duration(Case): input: str`."""

    key: str


class CaseOptions(EvalOptions, Generic[T], total=False):
    """An eval's options with `cases`: each case runs the body, `(c, case)`, with every cell and
    run, and the cases pool into one pass rate (and, with `compare`, one lift paired by case).
    Per eval only."""

    cases: Required[Sequence[T]]
    """The inputs, each a dict (or a dataclass) of JSON data with its `key`, which names the case
    in the output and the record: 1–80 characters, with no surrounding whitespace, `#`, `›` or
    control characters, and unique within the eval."""
