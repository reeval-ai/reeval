from reeval_python import define_environment, evaluate, regression

base = define_environment("base", {"env": {"MODE": "base"}})
skilled = base.extend("skilled", {"env": {"MODE": "skilled"}})
terse = base.extend("terse", {"env": {"MODE": "terse"}})


@evaluate(
    "baseline and two variants", {"compare": {"baseline": base, "variants": [skilled, terse]}}
)
async def baseline_and_two(c): ...


@evaluate(
    "every cell gated, with a minimum lift",
    {
        "compare": {"baseline": base, "variants": [skilled], "min_lift": 0.2},
        "target": regression(),
        "trials": 2,
    },
)
async def gated(c): ...
