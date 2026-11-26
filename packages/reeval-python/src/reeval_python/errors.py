"""Errors raised by the public Python API."""

from __future__ import annotations

import json
from typing import Any


class ReevalCallError(Exception):
    """reeval refused a call or couldn't make it. `name` is reeval's name for why, such as
    `TimeoutError`."""

    def __init__(self, name: str, message: str) -> None:
        super().__init__(message)
        self.name = name


class EvalError(Exception):
    """Raised by an eval's body to stop the attempt before it's graded: the attempt didn't get
    far enough. It fails the attempt as any exception the body raises does, and reads back
    better: `reason` is the attempt's headline and `meta`, a JSON object, is recorded beside it.
    `raise EvalError(...) from exc` keeps what caused it."""

    def __init__(self, reason: str, *, meta: dict[str, Any] | None = None) -> None:
        if not reason.strip():
            raise TypeError('EvalError takes a reason: EvalError("the build fails")')
        if meta is not None:
            try:
                encoded = json.dumps(meta, allow_nan=False)
            except (TypeError, ValueError) as exc:
                raise TypeError(f"EvalError meta takes JSON: {exc}") from None
            if not encoded.startswith("{"):
                raise TypeError("EvalError meta takes a dict, such as {'exit_code': 1}")
        super().__init__(reason)
        self.reason = reason
        self.meta = meta


class AttemptAborted(BaseException):  # noqa: N818
    """reeval aborted the attempt (its timeout ran out, or the run was canceled): every call the
    body makes from then on raises this. A `BaseException`, so `except Exception` can't keep a
    body running that reeval has already given up on."""

    def __init__(self, name: str, message: str) -> None:
        super().__init__(message)
        self.name = name
