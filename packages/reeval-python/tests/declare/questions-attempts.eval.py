from reeval_python import define_environment, evaluate, metric

base = define_environment("base", {"env": {"MODE": "base"}})
skilled = base.extend("skilled", {"env": {"MODE": "skilled"}})


@evaluate(
    "asked of each attempt",
    {"questions": [{"question": "How did the agent find the failing test?", "trajectory": True}]},
)
async def asked_of_each_attempt(c): ...


@evaluate(
    "with choices",
    {
        "runs": 2,
        "target": metric(0.5),
        "questions": [
            {
                "question": "Did the agent run the tests first?",
                "choices": ["yes", "no"],
                "trajectory": "tools",
            }
        ],
    },
)
async def with_choices(c): ...


@evaluate(
    "beside a compare",
    {
        "compare": {"control": base, "variants": [skilled]},
        "questions": [
            {"question": "What did the agent read first?", "trajectory": "tools"},
            {"question": "Which is cleaner?", "across": "environment", "diff": True},
        ],
    },
)
async def beside_a_compare(c): ...


@evaluate(
    "across harnesses without a compare",
    {
        "questions": [
            {
                "question": "Which agent explained its change better?",
                "across": "agent",
                "diff": True,
            }
        ]
    },
)
async def across_harnesses_without_a_compare(c): ...
