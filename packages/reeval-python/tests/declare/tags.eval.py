from reeval_python import evaluate, group


def slow_things():
    @evaluate("big")
    def big(c): ...

    @evaluate("bigger", {"tags": ["flaky"]})
    def bigger(c): ...


group("slow things", {"tags": ["slow"]}, slow_things)


@evaluate("quick")
def quick(c): ...


@evaluate("case", {"cases": [{"key": "1"}, {"key": "2"}], "tags": ["slow"]})
def case(c, case): ...
