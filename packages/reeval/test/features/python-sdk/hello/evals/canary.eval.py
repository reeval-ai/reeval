from reeval_python import evaluate


@evaluate("canary")
def canary(c):
    print("looking for missing-greet.py")
    assert c.exec("test -f missing-greet.py").ok, "missing-greet.py exists"
