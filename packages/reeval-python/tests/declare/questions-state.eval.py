from reeval_python import define_environment, evaluate

base = define_environment("base", {"env": {"MODE": "base"}})
skilled = base.extend("skilled", {"env": {"MODE": "skilled"}})


@evaluate(
    "trajectory across harnesses",
    {
        "compare": {"baseline": base, "variants": [skilled]},
        "questions": [
            {
                "question": "Which agent verified its work?",
                "across": "agent",
                "trajectory": "tools",
            }
        ],
    },
)
async def trajectory_across_harnesses(c): ...


@evaluate(
    "trajectory within a harness",
    {
        "compare": {"baseline": base, "variants": [skilled]},
        "questions": [
            {
                "question": "Which environment verified its work?",
                "across": "environment",
                "trajectory": "tools",
            }
        ],
    },
)
async def trajectory_within_a_harness(c): ...


@evaluate(
    "screenshots",
    {
        "compare": {"baseline": base, "variants": [skilled]},
        "questions": [
            {
                "question": "Which page looks better?",
                "across": "environment",
                "artifacts": ["landing"],
            }
        ],
    },
)
async def screenshots(c): ...


@evaluate(
    "each trial with the trajectory",
    {
        "questions": [
            {
                "question": "What did the agent check before it finished?",
                "task": True,
                "output": True,
                "diff": True,
                "trajectory": True,
            }
        ]
    },
)
async def each_trial_with_the_trajectory(c): ...


@evaluate(
    "each trial without the trajectory",
    {
        "questions": [
            {
                "question": "What did the agent say it did?",
                "task": True,
                "output": True,
                "diff": True,
            }
        ]
    },
)
async def each_trial_without_the_trajectory(c): ...
