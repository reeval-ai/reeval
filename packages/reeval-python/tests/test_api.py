"""The public API's data: options in reeval's spelling at any depth, the cases an eval
takes, environments that don't change under the eval, and plugin builds on every source."""

from __future__ import annotations

import gc
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest

from reeval_python import (
    TrialContext,
    BuiltinGrader,
    define_environment,
    docker,
    evaluate,
    fake_harness,
    group,
    plugin,
    tart,
)
from reeval_python.declare import collect_module_tree_sync
from reeval_python.wire import options_to_wire


def test_reeval_keys_are_camel_cased_at_any_depth_and_record_keys_are_not() -> None:
    wire = options_to_wire(
        {
            "compare": {"min_lift": 0.1},
            "judge": {"provider_options": {"google": {"thinking_config": 1}}},
            "agents": fake_harness(delay_ms=5, fail_with="boom"),
            "sandbox": docker(start_timeout=60, env={"MY_VAR": "x", "snake_key": "y"}),
            "not_a_reeval_key": 1,
        }
    )
    assert wire == {
        "compare": {"minLift": 0.1},
        "judge": {"providerOptions": {"google": {"thinking_config": 1}}},
        "agents": {"kind": "fake", "delayMs": 5, "failWith": "boom"},
        "sandbox": {
            "kind": "docker",
            "startTimeout": "1m",
            "env": {"MY_VAR": "x", "snake_key": "y"},
        },
        "not_a_reeval_key": 1,
    }


@pytest.mark.parametrize(
    ("given", "wire"),
    [
        (90, "90s"),
        (1.5, "1500ms"),
        (0.25, "250ms"),
        (timedelta(minutes=5), "5m"),
        (timedelta(hours=2), "2h"),
        (timedelta(milliseconds=1.5), "1.5ms"),
    ],
)
def test_a_duration_is_seconds_or_a_timedelta(given: Any, wire: str) -> None:
    assert options_to_wire({"timeout": given}) == {"timeout": wire}
    sandbox = options_to_wire({"sandbox": docker(start_timeout=given)})
    assert sandbox == {"sandbox": {"kind": "docker", "startTimeout": wire}}


def test_tart_names_its_image_and_camel_cases_its_options() -> None:
    sandbox = options_to_wire(
        {"sandbox": tart("ghcr.io/cirruslabs/macos-sequoia-base:latest", max_concurrent=1)}
    )
    assert sandbox == {
        "sandbox": {
            "kind": "tart",
            "image": "ghcr.io/cirruslabs/macos-sequoia-base:latest",
            "maxConcurrent": 1,
        }
    }


@pytest.mark.parametrize("given", ["1s", True, None, float("nan"), float("inf")])
def test_a_duration_refuses_anything_but_seconds(given: Any) -> None:
    with pytest.raises(TypeError, match="timeout takes seconds or a timedelta"):
        options_to_wire({"timeout": given})


def test_an_environment_spec_is_camel_cased_and_copied() -> None:
    spec: dict[str, Any] = {"sandbox": {"kind": "docker", "max_concurrent": 2}, "env": {"A": "1"}}
    env = define_environment("e", spec)
    spec["env"]["A"] = "changed"
    child = env.extend("child", spec)
    spec["env"]["A"] = "changed again"
    layers = child._to_wire()["layers"]  # pyright: ignore[reportPrivateUsage]
    assert layers[0]["spec"] == {
        "sandbox": {"kind": "docker", "maxConcurrent": 2},
        "env": {"A": "1"},
    }
    assert layers[1]["spec"]["env"] == {"A": "changed"}


def test_every_plugin_source_takes_a_build() -> None:
    sources = [
        plugin.local("plugins/lint", build="npm run build"),
        plugin.git("github:acme/lint", build=("npm ci", "npm run build")),
        plugin.npm("@acme/lint", build={"run": "make", "cwd": "src"}),
        plugin.marketplace("lint@github:acme/plugins", build=["make"]),
    ]
    assert repr(sources[0]) == "Plugin(source='local', path='plugins/lint', build='npm run build')"
    assert [p._to_wire()["build"] for p in sources] == [  # pyright: ignore[reportPrivateUsage]
        "npm run build",
        ["npm ci", "npm run build"],
        {"run": "make", "cwd": "src"},
        ["make"],
    ]


@pytest.mark.parametrize("cases", ["abc", (c for c in "ab"), {"a": 1}])
def test_cases_must_be_a_list(cases: Any) -> None:
    def load() -> None:
        evaluate("case", {"cases": cases})(lambda c, case: None)  # pyright: ignore[reportCallIssue, reportArgumentType]

    with pytest.raises(TypeError, match=r"cases in evaluate\('case'\) must be a list"):
        collect_module_tree_sync(load)


@pytest.mark.parametrize(
    ("opts", "message"),
    [
        ({"cases": []}, r"cases in evaluate\('e'\) is an empty list"),
        ({"cases": [{"n": 1}]}, r"cases\[0\] in evaluate\('e'\) has no key"),
        (
            {"cases": ["a"]},
            r"cases\[0\] in evaluate\('e'\) is 'a': a case is a dict or a dataclass with a key",
        ),
        ({"cases": [{"key": 1}]}, r"has the key 1: a case's key is a string"),
        (
            {"cases": [{"key": "a"}, {"key": "a"}]},
            r"cases\[0\] and cases\[1\] in evaluate\('e'\) have the same key 'a'",
        ),
        ({"cases": [{"key": "a#b"}]}, r"has the key 'a#b': a case key is 1–80 characters"),
        ({"cases": [{"key": " a"}]}, r"has the key ' a': a case key is 1–80 characters"),
        (
            {"cases": [{"key": "a"}, {"key": "b"}], "trials": {"best_of": 3}},
            r"evaluate\('e'\) has cases, so it can't take trials",
        ),
    ],
)
def test_bad_cases_are_refused_where_they_are_declared(opts: Any, message: str) -> None:
    def load() -> None:
        evaluate("e", opts)(lambda c, case: None)

    with pytest.raises((TypeError, ValueError), match=message):
        collect_module_tree_sync(load)


@dataclass
class Keyed:
    key: str


def test_cases_key_their_evals_and_name_their_eval() -> None:
    def load() -> None:
        evaluate("e", {"cases": [{"key": "users"}, {"key": "2"}, Keyed("x")]})(lambda c, case: None)
        evaluate("one", {"cases": [{"key": "s", "slug": "s"}]})(lambda c, case: None)

    tree = collect_module_tree_sync(load)
    names = [child["name"] for child in tree["children"]]
    assert names == ["e [users]", "e [2]", "e [x]", "one [s]"]
    assert tree["children"][1]["family"] == {"name": "e", "case": 1, "cases": 3}
    assert tree["children"][3]["family"] == {"name": "one", "case": 0, "cases": 1}


def test_built_in_graders_are_declared_as_data_on_each_case() -> None:
    graders: list[BuiltinGrader] = [{"builtin": "used-skill", "args": ["x"], "weight": 2}]

    def load() -> None:
        evaluate("e", {"graders": graders, "trials": 2})(lambda c: None)
        evaluate("f", {"cases": [{"key": "a"}, {"key": "b"}], "graders": graders})(
            lambda c, case: None
        )
        evaluate("g")(lambda c: None)

    tree = collect_module_tree_sync(load)
    assert [child.get("graders") for child in tree["children"]] == [graders, graders, graders, None]
    assert tree["children"][0]["options"] == {"trials": 2}


@pytest.mark.parametrize("graders", ["used-skill", [{"args": ["x"]}], [lambda: None]])
def test_graders_must_be_built_ins_as_data(graders: Any) -> None:
    def load() -> None:
        evaluate("e", {"graders": graders})(lambda c: None)

    with pytest.raises(TypeError, match=r"graders in evaluate\('e'\) must be a list of built-in"):
        collect_module_tree_sync(load)


def test_a_group_refuses_graders() -> None:
    def load() -> None:
        group("g", {"graders": [{"builtin": "turns"}]}, lambda: None)

    with pytest.raises(TypeError, match=r"group\('g'\) sets graders, which are per eval"):
        collect_module_tree_sync(load)


def test_cases_refuse_a_body_without_the_case_where_it_is_declared() -> None:
    def load() -> None:
        @evaluate("case", {"cases": [{"key": "1"}, {"key": "2"}]})
        def _(c: Any) -> None: ...

    with pytest.raises(TypeError, match=r"the body takes the trial and its case"):
        collect_module_tree_sync(load)


def test_an_async_command_is_a_coroutine_that_warns_if_never_awaited() -> None:
    async def send(call: Any) -> dict[str, Any]:
        return {"ok": True}

    c = TrialContext("k1", send)
    with pytest.warns(RuntimeWarning, match="was never awaited"):
        c.exec("npm install")
        gc.collect()


def test_an_eval_declared_twice_is_refused_where_it_is_declared() -> None:
    def load() -> None:
        def body(c: Any) -> None: ...

        evaluate("a", body)
        group("g", lambda: evaluate("a", body))
        evaluate("a", body)

    with pytest.raises(ValueError, match=r"evaluate\('a'\) is declared twice") as raised:
        collect_module_tree_sync(load)
    assert "cases" not in str(raised.value)


def test_two_evals_with_cases_and_one_name_are_refused() -> None:
    def load() -> None:
        @evaluate("case", {"cases": [{"key": "1"}, {"key": "2"}]})
        def _(c: Any, case: Any) -> None: ...

        @evaluate("case", {"cases": [{"key": "3"}, {"key": "4"}, {"key": "5"}]})
        def _(c: Any, case: Any) -> None: ...

    with pytest.raises(ValueError, match=r"evaluate\('case'\) with cases is declared twice"):
        collect_module_tree_sync(load)


def test_one_name_with_cases_in_two_groups_is_accepted() -> None:
    def load() -> None:
        def body(c: Any, case: Any) -> None: ...

        group("g", lambda: evaluate("c", {"cases": [{"key": "1"}, {"key": "2"}]})(body))
        group("h", lambda: evaluate("c", {"cases": [{"key": "1"}, {"key": "2"}]})(body))

    tree = collect_module_tree_sync(load)
    assert len(tree["children"]) == 2


def test_a_name_holding_the_id_separator_is_refused_beside_a_grouped_eval() -> None:
    def load() -> None:
        def body(c: Any) -> None: ...

        group("g", lambda: evaluate("e", body))
        evaluate("g › e", body)

    with pytest.raises(ValueError, match=r"declared twice.*\" › \" joins the group and eval names"):
        collect_module_tree_sync(load)


@pytest.mark.parametrize("eval_first", [True, False])
def test_an_eval_named_like_one_with_cases_is_refused(eval_first: bool) -> None:
    def load() -> None:
        def body(c: Any) -> None: ...

        def each(c: Any, case: Any) -> None: ...

        if eval_first:
            evaluate("case", body)
        evaluate("case", {"cases": [{"key": "1"}, {"key": "2"}]})(each)
        if not eval_first:
            evaluate("case", body)

    with pytest.raises(ValueError, match=r"has the same id as evaluate\('case'\) with cases"):
        collect_module_tree_sync(load)


@pytest.mark.parametrize("kind", ["def", "async def"])
def test_a_generator_body_is_refused_where_it_is_declared(kind: str) -> None:
    source = f"{kind} body(c):\n    yield\n"
    space: dict[str, Any] = {}
    exec(source, space)  # noqa: S102

    with pytest.raises(TypeError, match="an eval body can't yield"):
        collect_module_tree_sync(lambda: evaluate("g", space["body"]))
    with pytest.raises(TypeError, match="an eval body can't yield"):
        collect_module_tree_sync(lambda: evaluate("g", {"cases": [{"key": "1"}]})(space["body"]))


USER_EVAL = """
from reeval_python import TrialContext, evaluate


@evaluate("typed", {"timeout": 1})
async def typed(c: TrialContext) -> None:
    flag = bool(len("x"))
    await c.exec("true", background=flag)


@evaluate("bare")
def bare(c) -> None: ...


reveal_type(typed)
"""


def test_a_user_eval_type_checks_under_strict_pyright(tmp_path: Path) -> None:
    pyright = shutil.which("pyright")
    if pyright is None:
        pytest.skip("pyright isn't on PATH")
    (tmp_path / "x.eval.py").write_text(USER_EVAL)
    src = str(Path(__file__).resolve().parents[1] / "src")
    config = {
        "typeCheckingMode": "strict",
        "extraPaths": [src],
        "reportUnknownParameterType": False,
    }
    config |= {"reportMissingParameterType": False, "reportUnknownArgumentType": False}
    (tmp_path / "pyrightconfig.json").write_text(json.dumps(config))
    out = subprocess.run(
        [pyright, "--outputjson", "--pythonpath", sys.executable],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    report = json.loads(out.stdout)
    errors = [d["message"] for d in report["generalDiagnostics"] if d["severity"] == "error"]
    assert errors == []
    [revealed] = [
        d["message"] for d in report["generalDiagnostics"] if d["severity"] == "information"
    ]
    assert "Coroutine" in revealed, revealed
