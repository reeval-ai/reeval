from reeval_python import evaluate


# The mistake: the command prints `ran`, not `skipped`.
@evaluate("canary")
def canary(c):
    out = c.exec("echo ran").stdout.strip()
    assert out == "skipped", f"ran: {out!r} is not 'skipped'"
