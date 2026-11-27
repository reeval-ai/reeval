"""Python eval authoring API for reeval (*.eval.py)."""

from reeval_python.context import TrialContext, SyncTrialContext
from reeval_python.declare import evaluate, group, todo
from reeval_python.environment import (
    DEFAULT_EGRESS_ALLOW,
    DockerSandbox,
    Environment,
    FakeHarness,
    FakeJudge,
    Plugin,
    PluginBuild,
    TartSandbox,
    define_environment,
    docker,
    fake_harness,
    fake_judge,
    plugin,
    tart,
)
from reeval_python.errors import EvalError, ReevalCallError
from reeval_python.options import (
    BestOf,
    BuiltinGrader,
    Case,
    CaseOptions,
    EvalOptions,
    JudgeDefaults,
)
from reeval_python.target import Target, capability, regression
from reeval_python.types import (
    BackgroundHandle,
    Decision,
    DecisionUsage,
    Diff,
    ExecResult,
    FileChange,
    Turn,
)

__all__ = [
    "DEFAULT_EGRESS_ALLOW",
    "TrialContext",
    "BackgroundHandle",
    "Decision",
    "DecisionUsage",
    "BestOf",
    "BuiltinGrader",
    "Diff",
    "DockerSandbox",
    "Environment",
    "Case",
    "EvalError",
    "CaseOptions",
    "EvalOptions",
    "ExecResult",
    "FakeHarness",
    "FakeJudge",
    "FileChange",
    "JudgeDefaults",
    "Plugin",
    "PluginBuild",
    "ReevalCallError",
    "SyncTrialContext",
    "Target",
    "TartSandbox",
    "Turn",
    "define_environment",
    "docker",
    "evaluate",
    "fake_harness",
    "capability",
    "fake_judge",
    "group",
    "plugin",
    "regression",
    "tart",
    "todo",
]
