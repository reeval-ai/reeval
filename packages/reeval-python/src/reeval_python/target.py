"""An eval's target: whether it passes and can fail the run, over its trials' scores."""

from reeval_python.environment import _Descriptor  # pyright: ignore[reportPrivateUsage]


class Target(_Descriptor):
    """An eval's target, made by `regression(…)` or `capability(…)`."""


def regression(threshold: float = 1) -> Target:
    """Passes when every trial scores at least `threshold` (pass^k); a miss fails the run."""
    return Target({"kind": "regression", "threshold": threshold})


def capability(threshold: float = 1, *, blocking: bool = False) -> Target:
    """Passes when one trial scores at least `threshold` (pass@k). A miss fails the run only
    with `blocking=True`. The default target is `capability()`."""
    return Target({"kind": "capability", "threshold": threshold, "blocking": blocking})
