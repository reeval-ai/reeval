"""Trial context: native Python API over the trial protocol."""

from __future__ import annotations

import base64
import itertools
from collections.abc import Awaitable, Callable, Coroutine, Mapping
from contextvars import ContextVar
from datetime import timedelta
from typing import Any, Literal, TypeVar, cast, overload

from reeval_python._wire import (
    DecideStatePart,
    DecideStatePartInputs,
    TrialCall,
    TrialCallDecide,
    TrialCallExec,
)
from reeval_python.errors import ReevalCallError
from reeval_python.types import BackgroundHandle, Decision, ExecResult, Turn
from reeval_python.wire import json_value, seconds

T = TypeVar("T")

# An async body's calls not awaited yet: each one's name, and how to close it. The runner fails
# a body that leaves any, since what wasn't awaited never ran.
_unawaited: ContextVar[dict[int, tuple[str, Callable[[], None]]] | None] = ContextVar(
    "_unawaited", default=None
)

_tokens = itertools.count()


def track_calls() -> None:
    """Notes the calls the body in this context makes until each is awaited."""
    _unawaited.set({})


def tracked(coro: Coroutine[Any, Any, T], name: str) -> Coroutine[Any, Any, T]:
    """`coro`, noted as not yet run until it's first awaited (or a task starts it)."""
    pending = _unawaited.get()
    if pending is None:
        return coro
    token = next(_tokens)

    async def run() -> T:
        pending.pop(token, None)
        return await coro

    wrapper = run()

    def close() -> None:
        wrapper.close()
        coro.close()

    pending[token] = (name, close)
    return wrapper


def unawaited() -> list[str]:
    """The body's calls it never awaited, closed so Python doesn't warn too."""
    pending = _unawaited.get() or {}
    names = [name for name, _ in pending.values()]
    for _, close in pending.values():
        close()
    pending.clear()
    return names


DecideState = str | Mapping[str, Any] | list[DecideStatePart]


def _input_on(value: object) -> bool:
    return (
        value is not None
        and value is not False
        and not (isinstance(value, (list, tuple)) and not value)
    )


def _state_part(
    output: bool,
    diff: bool | list[str] | None,
    contents: list[str] | None,
    observations: bool | list[str] | None,
    trajectory: bool | str | Mapping[str, Any] | None,
    on: Turn | None,
) -> DecideStatePartInputs:
    part: dict[str, Any] = {"type": "inputs"}
    for key, value in (
        ("diff", diff),
        ("contents", contents),
        ("observations", observations),
        ("trajectory", trajectory),
    ):
        if value is not None:
            part[key] = value
    if output:
        part["output"] = True
    if on is not None:
        part["on"] = {"turn": on.index}
    if not any(
        _input_on(part.get(key))
        for key in ("output", "diff", "contents", "observations", "trajectory")
    ):
        raise TypeError(
            "c.state() shows nothing: turn on output, diff, contents, observations or trajectory"
        )
    return cast(DecideStatePartInputs, part)


def _decide_call(
    state: DecideState,
    questions: Mapping[str, Any],
    model: str | None,
    provider_options: Mapping[str, Mapping[str, Any]] | None,
) -> TrialCallDecide:
    call: dict[str, Any] = {
        "op": "decide",
        "state": json_value(state, "c.decide()'s state is a string, a JSON object or parts"),
        "questions": json_value(questions, "c.decide()'s questions are JSON"),
    }
    if model is not None:
        call["model"] = model
    if provider_options is not None:
        call["providerOptions"] = json_value(provider_options, "providerOptions are JSON")
    return cast(TrialCallDecide, call)


SendFn = Callable[[TrialCall], Awaitable[dict[str, Any]]]


def _exec_env(env: Mapping[str, str] | None) -> dict[str, str] | None:
    if env is None:
        return None
    if not isinstance(env, Mapping):  # pyright: ignore[reportUnnecessaryIsInstance]
        raise TypeError(
            f"c.exec(env=…) takes a mapping of names to strings (got {type(env).__name__})"
        )
    out: dict[str, str] = {}
    for name, value in env.items():
        if not isinstance(name, str) or not isinstance(value, str):  # pyright: ignore[reportUnnecessaryIsInstance]
            raise TypeError(
                f"c.exec(env=…) takes strings for names and values (got {name!r}: "
                f"{type(value).__name__})"
            )
        out[name] = value
    return out


class TrialContext:
    def __init__(self, trial_id: str, send: SendFn) -> None:
        self._trial = trial_id
        self._send = send
        self.turns: list[Turn] = []

    async def _call(self, call: TrialCall) -> dict[str, Any]:
        reply = await self._send(call)
        if not reply.get("ok", False):
            err = cast(dict[str, Any], reply.get("error") or {})
            raise ReevalCallError(str(err.get("name", "Error")), str(err.get("message", "")))
        return reply

    def send(self, prompt: str) -> Coroutine[Any, Any, Turn]:
        """Send the agent a prompt and wait for its turn to end."""
        return tracked(self._send_turn(prompt), "c.send()")

    async def _send_turn(self, prompt: str) -> Turn:
        reply = await self._call({"op": "send", "prompt": prompt})
        turn = Turn._from_wire(len(self.turns), cast(dict[str, Any], reply["turn"]))  # pyright: ignore[reportPrivateUsage]
        self.turns.append(turn)
        return turn

    @overload
    def exec(
        self,
        command: str,
        *,
        env: Mapping[str, str] | None = None,
        retries: int | None = None,
        interval: timedelta | float | None = None,
    ) -> Coroutine[Any, Any, ExecResult]: ...
    @overload
    def exec(
        self, command: str, *, background: Literal[True], env: Mapping[str, str] | None = None
    ) -> Coroutine[Any, Any, BackgroundHandle]: ...
    @overload
    def exec(
        self,
        command: str,
        *,
        background: bool,
        env: Mapping[str, str] | None = None,
        retries: int | None = None,
        interval: timedelta | float | None = None,
    ) -> Coroutine[Any, Any, ExecResult | BackgroundHandle]: ...

    def exec(
        self,
        command: str,
        *,
        background: bool = False,
        env: Mapping[str, str] | None = None,
        retries: int | None = None,
        interval: timedelta | float | None = None,
    ) -> Coroutine[Any, Any, ExecResult | BackgroundHandle]:
        """Run a command in the sandbox; with `background=True`, leave it running. `env` adds
        variables for this command only. With `retries`, a non-zero exit runs it again, up to
        that many extra times, `interval` apart (seconds or a timedelta, default 1 second), and
        it returns the last try."""
        return tracked(
            self._exec(command, background, _exec_env(env), retries, interval), "c.exec()"
        )

    async def _exec(
        self,
        command: str,
        background: bool,
        env: dict[str, str] | None,
        retries: int | None,
        interval: timedelta | float | None,
    ) -> ExecResult | BackgroundHandle:
        call: TrialCallExec = {"op": "exec", "command": command}
        if background:
            call["background"] = True
        if env is not None:
            call["env"] = env
        if retries is not None:
            call["retries"] = retries
        if interval is not None:
            ms = seconds(interval, "c.exec(interval=…)") * 1000
            if ms < 0:
                raise ValueError(f"c.exec(interval=…) takes 0 or more seconds (got {interval!r})")
            call["interval"] = int(ms) if ms == int(ms) else ms
        result = cast(dict[str, Any], (await self._call(call))["result"])
        return (
            BackgroundHandle._from_wire(result)  # pyright: ignore[reportPrivateUsage]
            if background
            else ExecResult._from_wire(command, result)  # pyright: ignore[reportPrivateUsage]
        )

    def read_file(self, path: str) -> Coroutine[Any, Any, str | None]:
        """A file's contents in the sandbox, or `None` when there's no such file."""
        return tracked(self._read_file(path), "c.read_file()")

    async def _read_file(self, path: str) -> str | None:
        contents = (await self._call({"op": "readFile", "path": path})).get("contents")
        return None if contents is None else str(contents)

    def file(self, path: str) -> Coroutine[Any, Any, str | None]:
        return self.read_file(path)

    def write_file(self, path: str, contents: str | bytes) -> Coroutine[Any, Any, None]:
        """Write a file in the sandbox's workspace."""
        return tracked(self._write_file(path, contents), "c.write_file()")

    async def _write_file(self, path: str, contents: str | bytes) -> None:
        if isinstance(contents, bytes):
            encoded = base64.b64encode(contents).decode()
            await self._call(
                {"op": "writeFile", "path": path, "contents": encoded, "encoding": "base64"}
            )
        else:
            await self._call({"op": "writeFile", "path": path, "contents": contents})

    def observe(self, name: str, value: object) -> Coroutine[Any, Any, None]:
        """Record a fact about the trial under `name`, such as what the agent installed. It
        never affects the outcome; observing a name again replaces its value. `value` is JSON."""
        data = json_value(value, f"c.observe({name!r}, …) takes a JSON value")
        return tracked(self._observe(name, data), "c.observe()")

    async def _observe(self, name: str, value: Any) -> None:
        await self._call({"op": "observe", "name": name, "value": value})

    def kill(self, handle: BackgroundHandle) -> Coroutine[Any, Any, None]:
        """Stop a command `c.exec(…, background=True)` left running."""
        return tracked(self._kill(handle), "c.kill()")

    async def _kill(self, handle: BackgroundHandle) -> None:
        await self._call({"op": "kill", "handle": handle.id})

    def decide(
        self,
        state: DecideState,
        questions: Mapping[str, Any],
        *,
        model: str | None = None,
        provider_options: Mapping[str, Mapping[str, Any]] | None = None,
    ) -> Coroutine[Any, Any, Decision]:
        """Ask a decision model `questions` about `state`, with the AI SDK's `experimental_decide`:
        a string, a JSON object or parts, such as `c.state(diff=True)`. The model is
        `'provider/model'`; default `decide.model`, then `analysis.model`. Returns the answers by
        question id, with the call's usage, warnings and response."""
        call = _decide_call(state, questions, model, provider_options)
        return tracked(self._decide(call), "c.decide()")

    async def _decide(self, call: TrialCallDecide) -> Decision:
        reply = await self._call(call)
        return Decision._from_wire(cast(dict[str, Any], reply["result"]))  # pyright: ignore[reportPrivateUsage]

    def state(
        self,
        *,
        output: bool = False,
        diff: bool | list[str] | None = None,
        contents: list[str] | None = None,
        observations: bool | list[str] | None = None,
        trajectory: bool | str | Mapping[str, Any] | None = None,
        on: Turn | None = None,
    ) -> DecideStatePart:
        """The judge's inputs as one part of `c.decide()`'s state, masked as a judge's are: the
        latest turn's, or `on` an earlier one's."""
        return _state_part(output, diff, contents, observations, trajectory, on)


class SyncTrialContext:
    """Sync façade: each method blocks on the runner's asyncio loop."""

    def __init__(self, async_ctx: TrialContext, loop: Any) -> None:
        self._ctx = async_ctx
        self._loop = loop

    @property
    def turns(self) -> list[Turn]:
        return self._ctx.turns

    def _run(self, coro: Coroutine[Any, Any, Any]) -> Any:
        import asyncio

        fut = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return fut.result()

    def send(self, prompt: str) -> Turn:
        """Send the agent a prompt and wait for its turn to end."""
        return self._run(self._ctx._send_turn(prompt))  # pyright: ignore[reportPrivateUsage]

    @overload
    def exec(
        self,
        command: str,
        *,
        env: Mapping[str, str] | None = None,
        retries: int | None = None,
        interval: timedelta | float | None = None,
    ) -> ExecResult: ...
    @overload
    def exec(
        self, command: str, *, background: Literal[True], env: Mapping[str, str] | None = None
    ) -> BackgroundHandle: ...
    @overload
    def exec(
        self,
        command: str,
        *,
        background: bool,
        env: Mapping[str, str] | None = None,
        retries: int | None = None,
        interval: timedelta | float | None = None,
    ) -> ExecResult | BackgroundHandle: ...

    def exec(
        self,
        command: str,
        *,
        background: bool = False,
        env: Mapping[str, str] | None = None,
        retries: int | None = None,
        interval: timedelta | float | None = None,
    ) -> ExecResult | BackgroundHandle:
        """Run a command in the sandbox and wait for it; with `background=True`, leave it
        running. `env` adds variables for this command only. With `retries`, a non-zero exit
        runs it again, up to that many extra times, `interval` apart (seconds or a timedelta,
        default 1 second), and it returns the last try."""
        return self._run(self._ctx._exec(command, background, _exec_env(env), retries, interval))  # pyright: ignore[reportPrivateUsage]

    def read_file(self, path: str) -> str | None:
        """A file's contents in the sandbox, or `None` when there's no such file."""
        return self._run(self._ctx._read_file(path))  # pyright: ignore[reportPrivateUsage]

    def file(self, path: str) -> str | None:
        return self.read_file(path)

    def write_file(self, path: str, contents: str | bytes) -> None:
        """Write a file in the sandbox's workspace."""
        self._run(self._ctx._write_file(path, contents))  # pyright: ignore[reportPrivateUsage]

    def observe(self, name: str, value: object) -> None:
        """Record a fact about the trial under `name`, such as what the agent installed. It
        never affects the outcome; observing a name again replaces its value. `value` is JSON."""
        data = json_value(value, f"c.observe({name!r}, …) takes a JSON value")
        self._run(self._ctx._observe(name, data))  # pyright: ignore[reportPrivateUsage]

    def kill(self, handle: BackgroundHandle) -> None:
        """Stop a command `c.exec(…, background=True)` left running."""
        self._run(self._ctx._kill(handle))  # pyright: ignore[reportPrivateUsage]

    def decide(
        self,
        state: DecideState,
        questions: Mapping[str, Any],
        *,
        model: str | None = None,
        provider_options: Mapping[str, Mapping[str, Any]] | None = None,
    ) -> Decision:
        """Ask a decision model `questions` about `state`, with the AI SDK's `experimental_decide`:
        a string, a JSON object or parts, such as `c.state(diff=True)`. The model is
        `'provider/model'`; default `decide.model`, then `analysis.model`. Returns the answers by
        question id, with the call's usage, warnings and response."""
        call = _decide_call(state, questions, model, provider_options)
        return self._run(self._ctx._decide(call))  # pyright: ignore[reportPrivateUsage]

    def state(
        self,
        *,
        output: bool = False,
        diff: bool | list[str] | None = None,
        contents: list[str] | None = None,
        observations: bool | list[str] | None = None,
        trajectory: bool | str | Mapping[str, Any] | None = None,
        on: Turn | None = None,
    ) -> DecideStatePart:
        """The judge's inputs as one part of `c.decide()`'s state, masked as a judge's are: the
        latest turn's, or `on` an earlier one's."""
        return _state_part(output, diff, contents, observations, trajectory, on)
