from reeval_python import evaluate


# A plain assert the body catches fails nothing, as in Python: only the try that held counts.
@evaluate("assert retries")
def assert_retries(c):
    for _ in range(2):
        try:
            assert c.exec("test -f ready.txt").ok
            break
        except AssertionError:
            c.exec("touch ready.txt")
