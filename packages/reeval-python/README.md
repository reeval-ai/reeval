# reeval-python

Python authoring SDK for [reeval](https://github.com/reeval-ai/reeval). Write `*.eval.py` files,
declare evals with the same options as TypeScript, and run them through reeval's language runner
(over its stdin and stdout, runner protocol 3). Use the reeval-python version that matches your
reeval: each says which runner protocol it speaks, and refuses another.

Import as `reeval_python` (`from reeval_python import evaluate`). The PyPI distribution is
**reeval-python** (the name `reeval` is already taken on PyPI by another project).

With reeval installed, default discovery includes `evals/**/*.eval.py`. When your project has
`pyproject.toml` or `uv.lock` and [uv](https://docs.astral.sh/uv/) is on `PATH`, reeval starts the
runner with `uv run --project <root> python -m reeval_python`. Otherwise it uses `<root>/.venv/bin/python`
when present, then `python3` (`python` on Windows). Set `REEVAL_PYTHON` to override the interpreter.
The standalone `reeval` binary works the same way and needs only uv besides; install the
reeval-python release made for your reeval, since a runner on another protocol stops the run.

## Install

```bash
uv add reeval-python
# or: pip install reeval-python
```

Then `uv run reeval run`. reeval-python's `reeval` command runs the reeval binary of its own
version: the first run downloads it from the GitHub release, checks it against the sha256 this
release recorded, and caches it in `<cache>/reeval/bin/<version>/`.

Monorepo development:

```bash
cd packages/reeval-python
uv sync --dev
uv run pytest
uv run ruff check .
uv run pyright
```

Declare trees are checked against `packages/reeval/test/conformance/declare/` goldens. From the
reeval package, `test/python-sdk.test.ts` runs the same suite in CI.

## Writing evals

```python
from reeval_python import SyncAttemptContext, evaluate


@evaluate("lands", {"runs": 3, "timeout": 300})
def lands(c: SyncAttemptContext) -> None:
    c.send("Create greet.py that prints hi")
    assert c.exec("python greet.py").stdout == "hi\n"
```

A body is the task: it drives the agent and fails the attempt by raising. Plain `assert` keeps
Python's semantics: a failure ends the body, and its message (or, with none, the statement as
written) is the attempt's failure. An `AssertionError` the body catches fails nothing, so a retry
loop can assert. Raise `EvalError("the build fails")` for an attempt that didn't get far enough to
grade. Use typed results (`ExecResult.ok`, `Turn.text`, …) and `c.file(path)`.

Use snake_case on the context (`read_file`, `write_file`, `file`). Options are typed
(`EvalOptions`), so pyright refuses a misspelled key such as `runz`. They take reeval's keys in
snake_case at any depth (`min_lift`, `delay_ms`); the keys of `env`, `headers` and the other maps of
your own keep their spelling. Every duration is seconds or a `timedelta`: `{"timeout": 90}`,
`docker(start_timeout=timedelta(minutes=2))`. `docker()`, `fake_harness()`, `fake_judge()` and
`plugin.*` return values to pass as options, not data to edit.

### `def` and `async def` bodies

A `def` body gets a blocking context: `c.exec(…)` runs the command and returns its `ExecResult`,
and `c.read_file(…)` returns the contents.

An `async def` body gets the async context: every `c.*` call is a coroutine to await. A call the
body never awaits never runs, so it fails the attempt, and so does a task the body started and
left running when it returns: await each one (`asyncio.gather`, a `TaskGroup`). A body that
`yield`s is refused where it's declared.

Annotate `c` (`SyncAttemptContext` or `AttemptContext`) and pyright checks the body too: a missing
`await`, the wrong context for the kind of body, a generator or a returned value. An unannotated
body is checked only when it runs.

```python
from reeval_python import AttemptContext, evaluate


@evaluate("lands, async")
async def lands(c: AttemptContext) -> None:
    await c.send("Create greet.py that prints hi")
    assert (await c.exec("python greet.py")).ok
```

`c.exec(cmd, retries=2, interval=2)` runs a command that exits non-zero again, up to 2 more
times, 2 seconds apart (`interval` is seconds or a timedelta, one second by default), and returns
the last try. Use it for a command that can fail on a transient, such as a test that calls a
model: `c.exec("pytest -q tests/hidden", retries=2)`. Any non-zero exit retries, and the record and
output say `passed on try 2 of 3`.

`c.exec(cmd, env={"EXPECTED": "42"})` sets variables for that command only, over the
environment's, in the background too. A value named like a secret (`*_TOKEN`, `*_KEY`, …) is
masked in everything reeval writes.

### Cases

`"cases"` runs one eval over a list, and the body takes the attempt and its case. Each case is a
dict (a `Case`, `TypedDict` with `key`) or a dataclass with a `key`. A key is 1–80 characters with
no surrounding whitespace, `#`, `›` or control characters, and unique within the eval; the run reports each case as `<eval> [<key>]`.

```python
@evaluate("greets", {"cases": [{"key": "en"}, {"key": "fr"}]})
def greets(c: SyncAttemptContext, case: Case) -> None: ...
```

## Examples

- Feature smoke: `packages/reeval/test/features/python-sdk/hello/` (uv project with a project dependency)
- Plan case: `packages/reeval/test/plan/python/`
- Contributor guide: `.agents/skills/add-a-language/SKILL.md` in the reeval repo
