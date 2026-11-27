"""Map public Python values to trial-protocol wire shapes (internal)."""

from __future__ import annotations

import json
import math
import re
from datetime import timedelta
from typing import Any, cast

from reeval_python._wire import CAMEL_KEYS, DURATION_FIELDS, RECORD_FIELDS
from reeval_python.types import ExecResult

_SNAKE = re.compile(r"[a-z][a-z0-9]*(?:_[a-z0-9]+)+")


def _camel(key: str) -> str:
    """reeval's spelling of one of its keys written in snake_case (`min_lift` -> `minLift`)."""
    if not _SNAKE.fullmatch(key):
        return key
    head, *rest = key.split("_")
    camel = head + "".join(part.capitalize() for part in rest)
    return camel if camel in CAMEL_KEYS else key


def seconds(value: object, where: str) -> float:
    """A duration the eval wrote, as seconds: a `timedelta`, or a number of seconds."""
    if isinstance(value, timedelta):
        return value.total_seconds()
    if isinstance(value, int | float) and not isinstance(value, bool) and math.isfinite(value):
        return float(value)
    raise TypeError(
        f"{where} takes seconds or a timedelta, e.g. 90 or timedelta(minutes=5) (got {value!r})"
    )


def _number(n: float) -> str:
    return str(int(n)) if n == int(n) else f"{n:.3f}".rstrip("0")


def duration_to_wire(value: Any, where: str) -> str:
    """A duration as reeval writes one: `"90s"`, `"5m"`, `"1h"` or `"250ms"`."""
    ms = round(seconds(value, where) * 1000, 3)
    for unit, size in (("h", 3_600_000), ("m", 60_000), ("s", 1000)):
        if ms and ms % size == 0:
            return f"{_number(ms / size)}{unit}"
    return f"{_number(ms)}ms"


def value_to_wire(value: Any, *, record: bool = False) -> Any:
    """Options as reeval's data: the SDK's objects (environments, sandboxes) as plain data,
    durations from seconds, and reeval's own keys at any depth in camelCase. A record's keys
    (`env`, `headers`, …) are the eval's own and keep their spelling; reeval names any other key
    it doesn't have."""
    to_wire = getattr(value, "_to_wire", None)
    if callable(to_wire):
        return to_wire()
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for key, item in cast(dict[str, Any], value).items():
            if record or not isinstance(cast(object, key), str):
                out[key] = value_to_wire(item, record=key in RECORD_FIELDS)
                continue
            name = _camel(key)
            if name in DURATION_FIELDS:
                out[name] = duration_to_wire(item, key)
            else:
                out[name] = value_to_wire(item, record=name in RECORD_FIELDS)
        return out
    if isinstance(value, list | tuple):
        return [value_to_wire(v) for v in cast(list[Any], value)]
    return value


def options_to_wire(options: dict[str, Any] | None) -> dict[str, Any] | None:
    """Eval, group or judge options as reeval's data."""
    if not options:
        return None
    return cast(dict[str, Any], value_to_wire(options))


def json_value(value: Any, where: str) -> Any:
    """A value reeval reads as JSON: an `ExecResult` as its data, and anything else that isn't
    JSON refused here, where the eval passed it."""
    if isinstance(value, ExecResult):
        return {"exitCode": value.exit_code, "stdout": value.stdout, "stderr": value.stderr}
    try:
        json.dumps(value, allow_nan=False)
    except TypeError as exc:
        raise TypeError(f"{where}: {exc}") from None
    except ValueError as exc:
        if "Circular reference" in str(exc):
            raise TypeError(f"{where}: it refers to itself, which JSON can't hold") from None
        # Python's own message for this names no value on some versions.
        raise TypeError(f"{where}: it isn't JSON, which has no NaN or Infinity") from None
    return value
