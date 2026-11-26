from reeval_python import evaluate


@evaluate(
    "builtins",
    {
        "graders": [
            {
                "builtin": "has-file",
                "args": ["src/retry.ts", {"regexp": "export function retry", "flags": "m"}],
            },
            {
                "builtin": "succeeded",
                "args": ["node --test"],
                "name": "tests-pass",
                "required": True,
            },
            {"builtin": "used-skill", "args": ["http-retries"], "weight": 2},
            {"builtin": "not-in-diff", "args": ["test/**"], "weight": 0},
            {"builtin": "turns"},
        ]
    },
)
async def builtins(c): ...
