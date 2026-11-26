from reeval_python import evaluate

WAIT = "while [ ! -s who.txt ]; do sleep 0.05; done; cat who.txt"


@evaluate("exec-env")
def exec_env(c):
    c.exec('printf %s "$GREETING"', env={"GREETING": "hello"})
    c.exec('printf %s "$WHO" > who.txt', background=True, env={"WHO": "background"})
    assert c.exec(WAIT).stdout == "background"
    assert c.exec('test "$WHO" = own', env={"WHO": "own"}).ok
