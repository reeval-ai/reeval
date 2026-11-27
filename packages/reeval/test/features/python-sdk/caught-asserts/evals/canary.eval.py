from reeval_python import evaluate


# The mistake: the same assert, not caught, fails the trial.
@evaluate("canary")
def canary(c):
    assert c.exec("test -f missing.txt").ok, "missing file"
