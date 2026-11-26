from reeval_python import evaluate


@evaluate("sync-async")
async def sync_async(c):
    assert (await c.exec("echo sync-async-ok")).ok
