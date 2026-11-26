from reeval_python import evaluate, group


# Runs beside the declared skips below, which the record marks `skip`.
@evaluate("lands")
def lands(c):
    assert c.exec("echo ran").stdout.strip() == "ran"


@evaluate("parked", mode="skip")
def parked(c):
    assert c.exec("false").ok


def shelved_evals():
    @evaluate("shelved")
    def shelved(c):
        assert c.exec("false").ok


group("shelf", shelved_evals, mode="skip")
