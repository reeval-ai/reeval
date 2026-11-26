from reeval_python import evaluate


@evaluate("sync-async")
def sync_async(c):
    assert c.exec("echo sync-async-ok").ok
