from reeval_python import capability, define_environment, evaluate, regression

base = define_environment("base", {"env": {"MODE": "base"}})
skilled = base.extend("skilled", {"env": {"MODE": "skilled"}})


@evaluate("best of", {"runs": {"best_of": 3}, "target": regression(0.8)})
async def best_of(c): ...


@evaluate("capability reports", {"runs": 3, "target": capability(0.5)})
async def capability_reports(c): ...


@evaluate("capability", {"runs": 3, "target": capability(1, blocking=True)})
async def capable(c): ...


@evaluate(
    "cases regression", {"cases": [{"key": "chat"}, {"key": "rag"}], "target": regression(0.8)}
)
async def cases_regression(c, case): ...


@evaluate(
    "compare regression",
    {"compare": {"control": base, "variants": [skilled]}, "target": regression(0.8), "runs": 2},
)
async def compare_regression(c): ...


@evaluate(
    "compare reports",
    {"compare": {"control": base, "variants": [skilled]}, "target": capability(), "runs": 4},
)
async def compare_reports(c): ...


@evaluate("reports", {"runs": 3})
async def reports(c): ...
