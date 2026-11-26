from reeval_python import evaluate
from reeval_python.errors import ReevalCallError


@evaluate("decide")
def decide(c):
    c.send("Write greet.js exporting greet(name).")
    try:
        c.decide(
            [{"type": "text", "text": "Did the agent write greet.js?"}, c.state(diff=True)],
            {"done": {"type": "boolean", "instructions": "Is greet.js written?"}},
        )
    except ReevalCallError:
        pass
