"""An eval's target: whether it passes and can fail the run, over its attempts' scores."""

from reeval_python.environment import _Descriptor  # pyright: ignore[reportPrivateUsage]


class Target(_Descriptor):
    """An eval's target, made by `metric(…)`, `regression(…)` or `capability(…)`."""


def metric(threshold: float | None = None) -> Target:
    """Passes when the attempts' mean score reaches `threshold`; with none it only reports,
    never failing the run. The default target."""
    if threshold is None:
        return Target({"kind": "metric"})
    return Target({"kind": "metric", "threshold": threshold})


def regression(threshold: float = 1) -> Target:
    """Passes when every attempt scores at least `threshold` (pass^k); a miss fails the run."""
    return Target({"kind": "regression", "threshold": threshold})


def capability(threshold: float = 1, *, blocking: bool = False) -> Target:
    """Passes when one attempt scores at least `threshold` (pass@k). A miss fails the run only
    with `blocking=True`."""
    return Target({"kind": "capability", "threshold": threshold, "blocking": blocking})
