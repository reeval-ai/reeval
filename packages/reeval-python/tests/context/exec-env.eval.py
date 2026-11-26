from reeval_python import evaluate

WAIT = "while [ ! -s who.txt ]; do sleep 0.05; done; cat who.txt"


@evaluate("exec-env")
async def exec_env(c):
    await c.exec('printf %s "$GREETING"', env={"GREETING": "hello"})
    await c.exec('printf %s "$WHO" > who.txt', background=True, env={"WHO": "background"})
    assert (await c.exec(WAIT)).stdout == "background"
    assert (await c.exec('test "$WHO" = own', env={"WHO": "own"})).ok
