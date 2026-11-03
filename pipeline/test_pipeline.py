"""Tests of the workspace pipeline: the change mapping of check.py and the helpers of steps.py."""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check  # noqa: E402
import steps  # noqa: E402

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
    import tomllib

    tasks = set()
    for f in (Path(__file__).parent / "tasks").glob("*.toml"):
        tasks |= set(tomllib.loads(f.read_text(encoding="utf-8")))
    root = tomllib.loads((Path(__file__).parent.parent / "mise.toml").read_text(encoding="utf-8"))
    tasks |= set(root.get("tasks", {}))
    scenes = set(check.e2e_scenes()) | {"*", "{stem}"}
    for rule in check.load_rules():
        assert set(rule.tasks) <= tasks, rule
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
