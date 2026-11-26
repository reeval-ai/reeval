from reeval_python import evaluate


# The mistake: expects the timed-out body's file, which never lands anywhere.
@evaluate("canary")
def canary(c):
    assert c.exec("test -f zombie.txt").ok, "zombie.txt exists"
