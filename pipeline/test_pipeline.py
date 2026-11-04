"""Tests of the workspace pipeline: the change mapping of check.py, the helpers of steps.py and the task config."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import textwrap
import time
import tomllib
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check  # noqa: E402
import steps  # noqa: E402

TASKS = {name: task for f in sorted((Path(__file__).parent / "tasks").glob("*.toml"))
         for name, task in tomllib.loads(f.read_text(encoding="utf-8")).items()}
TASKS |= tomllib.loads((Path(__file__).parent.parent / "mise.toml").read_text(encoding="utf-8"))["tasks"]

CHISEL = "BlueMap/gtnh-render/src/main/kotlin/de/bluecolored/bluemap/gtnh/render/mods/chisel/ChiselCtm.kt"


def plan(*files: str) -> check.Plan:
    return check.plan(list(files), check.load_rules())


def test_chisel_change_runs_only_gtnh_render_tests_and_its_two_scenes():
    p = plan(CHISEL)
    assert p.tasks == ["test:gtnh-render"]
    assert p.oracle == p.e2e == {"mod-renderers", "gtnh-zoo"}
    assert p.notes == []


def test_narrow_rules_win_over_wide_ones():
    p = plan("BlueMap/gtnh-render/src/main/kotlin/de/bluecolored/bluemap/gtnh/render/GtnhRender.kt")
    assert p.tasks == ["test:gtnh-render", "test:fork-oracle"] and p.oracle == {"*"}
    assert plan("BlueMap/gtnh-render/src/test/kotlin/X.kt").oracle == set()


def test_docs_run_nothing_and_site_docs_build_the_site():
    assert plan("README.md", "e2e/README.md", "BlueMap/gtnh-render/README.md").tasks == []
    assert plan("site/development/building.md").tasks == ["site"]


def test_scene_definition_maps_to_its_own_scene():
    p = plan("e2e/scenes/gt-ores.yaml")
    assert p.tasks == ["test:e2e"] and p.oracle == p.e2e == {"gt-ores"}


def test_oracle_code_runs_the_oracle_only():
    p = plan("e2e/src/e2e/oracle/faces.py")
    assert p.oracle == {"*"} and p.e2e == set()


def test_unmatched_file_runs_everything():
    p = plan("somewhere/new.txt")
    assert p.files["somewhere/new.txt"] is None
    assert p.tasks == list(check.EVERYTHING) and p.oracle == p.e2e == {"*"}


def test_every_rule_names_known_tasks_and_scenes():
    scenes = set(check.e2e_scenes()) | {"*", "{stem}"}
    for rule in check.load_rules():
        assert set(rule.tasks) <= set(TASKS), rule
        assert set(rule.scenes + rule.oracle + rule.e2e) <= scenes, rule


def test_commands_for_chisel(monkeypatch):
    monkeypatch.setattr(check, "baseline_scenes", lambda s: (sorted(s), []))
    monkeypatch.setattr(check, "world_calibrations", lambda: [Path("world-key.json")])
    labels = [label for label, _ in check.commands(plan(CHISEL))]
    assert labels == ["mise run test:gtnh-render", "mise run build-fork",
                      "oracle default+modernity: gtnh-zoo mod-renderers", "e2e: gtnh-zoo mod-renderers"]
    oracle = check.commands(plan(CHISEL))[2][1]
    assert "--no-capture" in oracle and "--all" in oracle


def test_calibration_scene_joins_the_oracle_run_without_a_stored_calibration(monkeypatch):
    monkeypatch.setattr(check, "baseline_scenes", lambda s: (sorted(s), []))
    monkeypatch.setattr(check, "world_calibrations", lambda: [])
    labels = [label for label, _ in check.commands(plan(CHISEL))]
    assert "oracle default+modernity: gtnh-zoo mod-renderers vanilla-zoo" in labels
    assert "e2e: gtnh-zoo mod-renderers" in labels


def test_newest_jar_skips_dev_and_sources(tmp_path):
    for name in ["bmh-0.1.0.jar", "bmh-0.2.0-dev.jar", "bmh-0.2.0-sources.jar", "bmh-0.2.0.jar"]:
        (tmp_path / name).write_bytes(name.encode())
        time.sleep(0.01)
    os.utime(tmp_path / "bmh-0.1.0.jar", (0, 0))
    assert steps.newest_jar(tmp_path, "bmh").name == "bmh-0.2.0.jar"


def test_install_replaces_other_versions_and_skips_identical(tmp_path):
    jar = tmp_path / "bmh-0.2.0.jar"
    jar.write_bytes(b"new")
    server = tmp_path / "server"
    (server / "mods").mkdir(parents=True)
    (server / "mods" / "bmh-0.1.0.jar").write_bytes(b"old")
    (server / "mods" / "other-1.0.jar").write_bytes(b"keep")
    assert "installed bmh-0.2.0.jar" in steps.install(jar, "bmh", [server, tmp_path / "missing"])[0]
    assert sorted(p.name for p in (server / "mods").iterdir()) == ["bmh-0.2.0.jar", "other-1.0.jar"]
    assert "already installed" in steps.install(jar, "bmh", [server])[0]


def test_adopt_checks_outputs_instead_of_running(tmp_path, monkeypatch):
    marker = tmp_path / "ran"
    command = [sys.executable, "-c", f"open({str(marker)!r}, 'w').close()"]
    monkeypatch.setenv("BMGTNH_ADOPT", "1")
    assert steps.adopt([str(tmp_path / "missing.zip")], command) == 1
    (tmp_path / "out.zip").write_bytes(b"")
    assert steps.adopt([str(tmp_path / "*.zip")], command) == 0 and not marker.exists()
    monkeypatch.delenv("BMGTNH_ADOPT")
    assert steps.adopt([str(tmp_path / "*.zip")], command) == 0 and marker.exists()


def test_report_accepts_exit_1_only_with_a_fresh_report(tmp_path):
    report = tmp_path / "report.json"
    fail = [sys.executable, "-c", "raise SystemExit(1)"]
    assert steps.run_with_report(report, fail) == 1
    write_and_fail = [sys.executable, "-c", f"open({str(report)!r}, 'w').write('{{}}'); raise SystemExit(1)"]
    assert steps.run_with_report(report, write_and_fail) == 0
    assert steps.run_with_report(report, [sys.executable, "-c", "raise SystemExit(2)"]) == 2


# ---------------------------------------------------------------- task config: concurrency and timeouts

BLUEMAP_CHAIN = ["build-fork", "build-servermod", "verify", "oracle:states-default", "oracle:states-modernity"]
CLIENT_CHAIN = ["export:default", "export:addons", "export:modernity", "oracle:states-default", "oracle:default",
                "oracle:modernity", "oracle:addons", "oracle:states-modernity"]


def runs(task: dict) -> str:
    run = task.get("run", [])
    return " ".join(r for r in ([run] if isinstance(run, str) else run) if isinstance(r, str))


def test_every_task_that_runs_something_has_a_timeout():
    assert [n for n, t in TASKS.items() if "run" in t and "timeout" not in t] == []


def test_gradle_runs_hold_the_lock_of_their_tree():
    trees = {"BlueMap": "gradle-BlueMap", "gtnh-exporter": "gradle-gtnh-exporter", "harness": "gradle-harness"}
    for name, task in TASKS.items():
        cmd = runs(task)
        if "gradlew" in cmd:
            tree = cmd.split("cd ", 1)[1].split("/")[0].split()[0]
            assert task.get("env", {}).get(steps.LOCKS_ENV) == trees[tree], name
    for name in BLUEMAP_CHAIN:  # also the tasks whose tools run Gradle in BlueMap/ (orch verify, e2e oracle states)
        assert TASKS[name]["env"][steps.LOCKS_ENV] == "gradle-BlueMap", name


@pytest.mark.parametrize("chain", [BLUEMAP_CHAIN, CLIENT_CHAIN], ids=["bluemap-tree", "client"])
def test_tasks_of_one_resource_wait_for_every_earlier_one(chain):
    # every earlier task, not only the one before: wait_for skips tasks that are not part of the run
    for i, name in enumerate(chain):
        assert set(chain[:i]) <= set(TASKS[name].get("wait_for", [])), name


def test_scenes_of_one_server_wait_for_every_earlier_one():
    servers: dict[str, list[str]] = {}
    for name, task in TASKS.items():
        if name.startswith("scene:"):
            server = "gtnh-addons" if "--server gtnh-addons" in runs(task) else "gtnh"
            servers.setdefault(server, []).append(name)
    assert len(servers["gtnh"]) == 9 and len(servers["gtnh-addons"]) == 3
    for chain in servers.values():
        for i, name in enumerate(chain):
            assert set(chain[:i]) <= set(TASKS[name]["wait_for"]), name


# ---------------------------------------------------------------- task shell, locks, timings


@pytest.fixture
def ws(tmp_path, monkeypatch):
    monkeypatch.setattr(steps.workspace, "ROOT", tmp_path)
    return tmp_path


def recorded(ws: Path) -> list[dict]:
    return steps.load_timings(ws / steps.TIMINGS)


def test_shell_runs_bash_with_pipefail_and_records_each_command(ws):
    assert steps.shell("echo ok", {"MISE_TASK_NAME": "a"}) == 0
    assert steps.shell("false | true", {"MISE_TASK_NAME": "b"}) == 1  # pipefail: a failed producer fails the command
    assert steps.shell("exit 3", {"MISE_TASK_NAME": "c", "BMGTNH_TIMINGS": "0"}) == 3
    entries = recorded(ws)
    assert [(e["task"], e["exit"], e["cmd"]) for e in entries] == [("a", 0, "echo ok"), ("b", 1, "false | true")]
    assert all(e["run"] == entries[0]["run"] and e["seconds"] >= 0 for e in entries)


def test_shell_lowers_the_priority_of_a_niced_task(ws):
    niceness = os.nice(0)
    assert steps.shell(f'test "$(nice)" = {niceness}', {"MISE_TASK_NAME": "normal"}) == 0
    assert steps.shell(f'test "$(nice)" = {min(19, niceness + 10)}', {"MISE_TASK_NAME": "niced", steps.NICE_ENV: "10"}) == 0


def test_only_the_tasks_beside_the_demo_and_site_give_up_cpu_priority():
    # the demo and the site are the critical path of a full run (oracle.toml); e2e and the oracle make way for them
    niced = {name for name, task in TASKS.items() if steps.NICE_ENV in task.get("env", {})}
    assert niced == {"e2e", "oracle:default", "oracle:modernity", "oracle:addons", "oracle:states-default",
                     "oracle:states-modernity"}


REGIONS = "{region,DIM1/region,DIM64/region,DIM112/region}"


def test_world_sources_name_each_world_and_its_region_directories():
    # mise walks every directory below a pattern's literal prefix (e2e.toml): no pattern into a world's ~250 directories,
    # and the tasks that read every world list each one a scene task writes
    worlds = sorted(o.split("/")[1] for t in TASKS.values() for o in t.get("outputs", []) if o.startswith("worlds-2.9.0/"))
    for name, task in TASKS.items():
        for source in task.get("sources", []):
            if source.startswith("worlds-2.9.0/"):
                assert "**" not in source and not source.startswith("worlds-2.9.0/*"), (name, source)
                assert source.endswith(("/level.dat", f"/{REGIONS}/*.mca")), (name, source)
    for name in ("e2e", "verify"):
        sources = TASKS[name]["sources"]
        assert [s for s in sources if s.endswith("/level.dat")] == [f"worlds-2.9.0/{w}/level.dat" for w in worlds], name
        assert f"worlds-2.9.0/{{{','.join(worlds)}}}/{REGIONS}/*.mca" in sources, name



def hold_lock_in_child(ws: Path, name: str) -> subprocess.Popen:
    code = textwrap.dedent(f"""
        import sys
        from pathlib import Path
        sys.path.insert(0, {str(Path(steps.__file__).parent)!r})
        import steps
        steps.workspace.ROOT = Path({str(ws)!r})
        with steps.task_lock({name!r}, "holder under test"):
            print("held", flush=True)
            sys.stdin.read()
    """)
    child = subprocess.Popen([sys.executable, "-c", code], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    assert child.stdout.readline().strip() == "held"
    return child


def test_a_task_lock_admits_one_holder_and_names_it(ws, capfd):
    child = hold_lock_in_child(ws, "gradle-BlueMap")
    try:
        with pytest.raises(steps.LockBusy, match="holder under test"):
            with steps.task_lock("gradle-BlueMap", "second", wait=0.3):
                pass
        with steps.task_lock("gradle-harness", "other tree", wait=0):  # another lock is free
            pass
        env = {"MISE_TASK_NAME": "t", steps.LOCKS_ENV: "gradle-BlueMap", steps.LOCK_WAIT_ENV: "0"}
        assert steps.shell("echo never", env) == 75
        assert "held by" in capfd.readouterr().err
    finally:
        child.stdin.close()
        child.wait()
    assert steps.shell("echo now", {"MISE_TASK_NAME": "t", steps.LOCKS_ENV: "gradle-BlueMap"}) == 0
    assert [e["exit"] for e in recorded(ws)] == [75, 0]


def test_shell_waits_for_a_held_lock_and_records_the_wait(ws):
    child = hold_lock_in_child(ws, "gradle-BlueMap")
    env = {**os.environ, "MISE_TASK_NAME": "waiter", steps.LOCKS_ENV: "gradle-BlueMap"}
    code = (f"import sys; sys.path.insert(0, {str(Path(steps.__file__).parent)!r}); import steps; from pathlib import Path; "
            f"steps.workspace.ROOT = Path({str(ws)!r}); sys.exit(steps.shell('echo ran'))")
    waiter = subprocess.Popen([sys.executable, "-c", code], env=env, stderr=subprocess.PIPE, text=True)
    assert "is held by pid" in waiter.stderr.readline()
    time.sleep(1.5)
    child.stdin.close()
    child.wait()
    assert waiter.wait(timeout=30) == 0
    (entry,) = recorded(ws)
    assert entry["task"] == "waiter" and entry["wait"] >= 1.0 and entry["seconds"] >= entry["wait"]


def test_shell_counts_the_launchers_client_lock_wait_and_still_relays_stderr(ws, capfd):
    script = "echo out; echo '[lock] client lock acquired after 2203s' >&2; echo after >&2"
    assert steps.shell(script, {"MISE_TASK_NAME": "client"}) == 0
    captured = capfd.readouterr()
    assert captured.out == "out\n"
    assert captured.err == "[lock] client lock acquired after 2203s\nafter\n"
    (entry,) = recorded(ws)
    assert entry["client_wait"] == 2203.0 and entry["wait"] >= 2203.0


def test_timings_summary_follows_the_declared_order_to_the_critical_path(ws, capsys):
    def entry(task, start, seconds, wait=0.0, run="1"):
        return {"task": task, "start": f"2026-11-03T10:00:{start:06.3f}+00:00", "seconds": seconds, "wait": wait,
                "exit": 0, "run": run, "mise": "mise run build ::: test", "cmd": task}
    # build-servermod started at once and waited 18 s for the BlueMap lock; build-exporter ended just after build-fork
    # but build-servermod does not wait for it
    entries = [entry("build-fork", 0, 20), entry("build-exporter", 0, 20.5), entry("test:launcher", 0, 5),
               entry("build-servermod", 2, 30, wait=18), entry("old", 0, 1, run="0")]
    order = steps.task_order()
    assert "build-fork" in order["build-servermod"] and "build-servermod" in order["test:servermod"]
    s = steps.summarize_run(entries[:4], order)
    assert s["wall"] == 32 and s["busy"] == 75.5
    assert s["critical"] == ["build-fork", "build-servermod"]
    path = ws / steps.TIMINGS
    path.parent.mkdir(parents=True)
    path.write_text("".join(json.dumps(e) + "\n" for e in entries[4:] + entries[:4]))
    assert steps.timings([]) == 0
    out = capsys.readouterr().out
    assert "wall 32.0 s" in out and "critical path: build-fork -> build-servermod" in out
    assert out.index("build-servermod") < out.index("build-exporter") < out.index("build-fork")  # slowest first
    assert "old" not in out
