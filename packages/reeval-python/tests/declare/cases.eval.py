from reeval_python import define_environment, evaluate

base = define_environment("base", {"env": {"MODE": "base"}})
skilled = base.extend("skilled", {"env": {"MODE": "skilled"}})


@evaluate(
    "pooled",
    {
        "cases": [{"key": "ada"}, {"key": "grace"}, {"key": "linus"}],
        "compare": {"control": base, "variants": [skilled], "min_lift": 0.2},
    },
)
async def pooled(c, who): ...


@evaluate(
    "keyed",
    {
        "cases": [
            {"key": "ada", "who": "Ada Lovelace"},
            {"key": "grace", "who": "Grace Hopper"},
        ],
        "compare": {"control": base, "variants": [skilled]},
    },
)
async def keyed(c, case): ...


@evaluate("one case is not pooled", {"cases": [{"key": "only"}]})
async def one_case(c, case): ...
