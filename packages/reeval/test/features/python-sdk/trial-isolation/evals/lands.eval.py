import time

from reeval_python import evaluate


# Runs first and times out. Its body wakes while "lands" (same file, same cell, so the same
# trial id) is running, and tries to run a command there.
@evaluate("times out", {"timeout": 1})
def times_out(c):
    time.sleep(2)
    c.exec("touch zombie.txt")


@evaluate("lands")
def lands(c):
    time.sleep(3)
    assert c.exec("test ! -f zombie.txt").ok
