"""Typed results for attempt calls (public, not wire-shaped)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, cast


@dataclass(frozen=True, slots=True)
class ExecResult:
    command: str
    exit_code: int
    stdout: str
    stderr: str

    @property
    def ok(self) -> bool:
        return self.exit_code == 0

    @classmethod
    def _from_wire(cls, command: str, data: dict[str, Any]) -> ExecResult:
        return cls(
            command=command,
            exit_code=int(data.get("exitCode", 1)),
            stdout=str(data.get("stdout") or ""),
            stderr=str(data.get("stderr") or ""),
        )


@dataclass(frozen=True, slots=True)
class BackgroundHandle:
    id: str

    @classmethod
    def _from_wire(cls, data: dict[str, Any]) -> BackgroundHandle:
        return cls(id=str(data.get("handle") or ""))


TurnStatus = Literal["completed", "aborted", "error"]


@dataclass(frozen=True, slots=True)
class FileChange:
    path: str
    status: Literal["added", "modified", "deleted"]


@dataclass(frozen=True, slots=True)
class Diff:
    """The workspace's changes since the eval started, as of the end of a turn."""

    files: tuple[FileChange, ...]
    patch: str


def _diff(data: Any) -> Diff | None:
    if not isinstance(data, dict):
        return None
    wire = cast(dict[str, Any], data)
    files = cast(list[dict[str, Any]], wire.get("files") or [])
    return Diff(
        files=tuple(FileChange(str(f.get("path")), f.get("status", "modified")) for f in files),
        patch=str(wire.get("patch") or ""),
    )


@dataclass(frozen=True, slots=True)
class Turn:
    """One `c.send(…)`: the prompt, the agent's final message and how the turn ended."""

    index: int
    prompt: str
    text: str
    status: TurnStatus
    model: str | None
    """The model the harness says served the turn, when it reports one."""
    diff: Diff | None

    @classmethod
    def _from_wire(cls, index: int, data: dict[str, Any]) -> Turn:
        model = data.get("model")
        return cls(
            index=index,
            prompt=str(data.get("prompt") or ""),
            text=str(data.get("text") or ""),
            status=cast(TurnStatus, data.get("status") or "error"),
            model=None if model is None else str(model),
            diff=_diff(data.get("diff")),
        )


def _int_or_none(value: Any) -> int | None:
    return None if value is None else int(value)


@dataclass(frozen=True, slots=True)
class DecisionUsage:
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None


@dataclass(frozen=True, slots=True)
class Decision:
    """`c.decide()`'s result: each question's answer by id, as `experimental_decide` returns it
    (`{"type": "boolean", "probability": 0.9}`), with the call's usage, warnings and response."""

    answers: dict[str, Any]
    usage: DecisionUsage
    warnings: list[Any]
    provider_metadata: dict[str, Any] | None
    model_id: str
    # ISO 8601.
    timestamp: str

    @classmethod
    def _from_wire(cls, data: dict[str, Any]) -> Decision:
        usage = cast(dict[str, Any], data.get("usage") or {})
        response = cast(dict[str, Any], data.get("response") or {})
        return cls(
            answers=dict(data.get("answers") or {}),
            usage=DecisionUsage(
                input_tokens=_int_or_none(usage.get("inputTokens")),
                output_tokens=_int_or_none(usage.get("outputTokens")),
                total_tokens=_int_or_none(usage.get("totalTokens")),
            ),
            warnings=list(data.get("warnings") or []),
            provider_metadata=data.get("providerMetadata"),
            model_id=str(response.get("modelId") or ""),
            timestamp=str(response.get("timestamp") or ""),
        )
