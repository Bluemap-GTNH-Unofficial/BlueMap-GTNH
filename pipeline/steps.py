#!/usr/bin/env python3
"""Small helpers the workspace tasks (`pipeline/tasks/*.toml`) share. Run from the workspace root.

    steps.py jar DIR PREFIX                     absolute path of the newest DIR/PREFIX-<version>.jar (not -dev/-sources)
    steps.py install DIR PREFIX SERVER...       copy that jar into each SERVER/mods/, replacing other PREFIX-*.jar
    steps.py addon-mods VERSION                 --extra-mod args for the addon jars of downloads/addons/versions.json
    steps.py adopt OUTPUT... -- CMD...          run CMD; with BMGTNH_ADOPT=1 only check that the outputs exist
    steps.py report REPORT -- CMD...            run CMD; exit 1 with a fresh REPORT counts as done (judged failures)
    steps.py doctor                             quick checks: tools, workspace inputs, Gradle caches, repositories
    steps.py plan [TASK...]                     the tasks `mise run TASK...` would run (default: all), recording nothing;
                                                tasks without declared outputs (test:*, verify) are always listed

`adopt` is how `mise run adopt` records the outputs already in the workspace as current without producing them again
(the first run of a task with sources always runs it, because mise has no record of it yet).
"""

from __future__ import annotations

import filecmp
import glob
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import workspace  # noqa: E402

SKIP_SUFFIXES = ("-dev", "-sources", "-api", "-javadoc")


def newest_jar(directory: Path, prefix: str) -> Path:
    """The newest ``<prefix>-<version>.jar`` in ``directory`` that is not a dev, sources, api or javadoc jar."""
    jars = [p for p in directory.glob(f"{prefix}-*.jar") if not p.stem.endswith(SKIP_SUFFIXES)]
    if not jars:
        raise SystemExit(f"no {prefix}-<version>.jar in {directory}")
    return max(jars, key=lambda p: p.stat().st_mtime)


def install(jar: Path, prefix: str, servers: list[Path]) -> list[str]:
    """Copies ``jar`` into ``<server>/mods/`` of each existing server, removing other ``<prefix>-*.jar`` there.
    An identical installed copy is left alone. Returns one line per server."""
    lines = []
    for server in servers:
        mods = server / "mods"
        if not mods.is_dir():
            lines.append(f"{server}: no mods/ folder, skipped")
            continue
        target = mods / jar.name
        stale = [p for p in mods.glob(f"{prefix}-*.jar") if p.name != jar.name]
        for p in stale:
            p.unlink()
        if target.is_file() and filecmp.cmp(jar, target, shallow=False):
            lines.append(f"{server}: {jar.name} already installed" + (f", removed {len(stale)} other" if stale else ""))
            continue
        tmp = mods / f".{jar.name}.tmp"
        shutil.copy2(jar, tmp)
        tmp.replace(target)  # atomic: a running server keeps reading the jar it opened
        lines.append(f"{server}: installed {jar.name}" + (f", removed {', '.join(p.name for p in stale)}" if stale else ""))
    return lines


def addon_mods(version: str) -> list[str]:
    """``--extra-mod <jar>`` for every addon jar (libraries such as GTNLLib are listed as addons) that
    ``downloads/addons/versions.json`` lists for pack ``version``."""
    folder = workspace.ROOT / "downloads" / "addons"
    data = json.loads((folder / "versions.json").read_text(encoding="utf-8"))
    addons = data.get("packs", {}).get(version, {}).get("addons")
    if addons is None:
        raise SystemExit(f"no addon set for pack version {version} in {folder / 'versions.json'}")
    args = []
    for name in dict.fromkeys(addon["file"] for addon in addons):
        if not (folder / name).is_file():
            raise SystemExit(f"addon jar missing: {folder / name}")
        args += ["--extra-mod", str(folder / name)]
    return args


def split_command(args: list[str]) -> tuple[list[str], list[str]]:
    if "--" not in args:
        raise SystemExit("expected: ... -- CMD...")
    i = args.index("--")
    return args[:i], args[i + 1:]


def adopt(outputs: list[str], command: list[str]) -> int:
    if not os.environ.get("BMGTNH_ADOPT"):
        return subprocess.call(command)
    missing = [pattern for pattern in outputs if not glob.glob(pattern, recursive=True)]
    if missing:
        print(f"[adopt] cannot adopt, missing: {', '.join(missing)}; run this task normally", file=sys.stderr)
        return 1
    print(f"[adopt] existing outputs recorded as current: {', '.join(outputs)}")
    return 0


def run_with_report(report: Path, command: list[str]) -> int:
    """Measurement commands exit 1 when some judged item fails; that still is a finished run if it wrote its report."""
    started = time.time()
    rc = subprocess.call(command)
    if rc == 1 and report.is_file() and report.stat().st_mtime >= started:
        print(f"[report] finished with judged failures, see {report}")
        return 0
    return rc


def doctor() -> int:
    """Quick checks that always run: tools, workspace inputs, Gradle cache settings, repository state."""
    problems = 0
    gradlew = (workspace.ROOT / "pipeline" / "gradlew").read_text(encoding="utf-8")
    javas = dict(line.split("=", 1) for line in gradlew.splitlines() if line.startswith(("JAVA25=", "JAVA8=")))
    tools = [(f"java {v}", ["mise", "where", f"java@{v}"]) for v in javas.values()]
    tools += [("uv", ["uv", "--version"]), ("pnpm", ["pnpm", "--version"]), ("git", ["git", "--version"])]
    for name, argv in tools:
        try:
            ok = subprocess.run(argv, capture_output=True, text=True).returncode == 0
        except FileNotFoundError:
            ok = False
        problems += not ok
        print(f"[doctor] {'ok  ' if ok else 'MISS'} {name}" + ("" if ok else f" ({' '.join(argv)} failed)"))
    if sys.version_info < (3, 13):
        problems += 1
        print(f"[doctor] MISS python >= 3.13 for pipeline/check.py (have {sys.version.split()[0]})")

    v = workspace.PACK_VERSION
    inputs = [f"servers/gtnh-{v}", f"servers/gtnh-addons-{v}", f"clients/gtnh-{v}", f"clients/gtnh-addons-{v}",
              f"clients/gtnh-modernity-{v}", "downloads/addons/versions.json", "downloads/modernity/release.json",
              f"baselines-{v}"]
    missing = [p for p in inputs if not (workspace.ROOT / p).exists()]
    print(f"[doctor] {'ok  ' if not missing else 'warn'} workspace inputs"
          + (f": missing {', '.join(missing)} (the tasks that need them fail)" if missing else ""))

    for props in ["BlueMap/gradle.properties", "BlueMap/implementations/gtnh/gradle.properties",
                  "gtnh-exporter/gradle.properties", "harness/gradle.properties"]:
        text = (workspace.ROOT / props).read_text(encoding="utf-8").replace(" ", "")
        if "org.gradle.caching=true" not in text:
            print(f"[doctor] warn {props}: local build cache off (org.gradle.caching=true missing)")

    for repo in workspace.REPOS:
        up = workspace.upstream(repo)
        dirty = len(workspace.git(repo, "status", "--porcelain", "--ignore-submodules=all").splitlines())
        counts = workspace.git(repo, "rev-list", "--left-right", "--count", f"{up}...HEAD").split() if up else []
        where = f"{counts[1]} ahead, {counts[0]} behind {up}" if len(counts) == 2 else "no upstream"
        print(f"[doctor]      {repo}: {workspace.git(repo, 'branch', '--show-current') or 'detached'}, {where}, "
              f"{dirty} uncommitted")
    return 1 if problems else 0


def plan(tasks: list[str]) -> int:
    """`mise run -n` on a throwaway copy of mise's state directory, printing only the tasks that would run.

    mise 2026.10.21 records a dry run in content-hash mode (`task.source_freshness_hash_contents`) as if the tasks had
    succeeded, so a plain `mise run -n` would mark stale tasks as up to date without running them."""
    import tempfile

    state = Path(os.environ.get("MISE_STATE_DIR") or Path.home() / ".local" / "state" / "mise")
    with tempfile.TemporaryDirectory(prefix="mise-plan-") as tmp:
        if state.is_dir():
            shutil.copytree(state, tmp, dirs_exist_ok=True, symlinks=True)
        proc = subprocess.run(["mise", "run", "--dry-run", *(tasks or ["all"])], capture_output=True, text=True,
                              env={**os.environ, "MISE_STATE_DIR": tmp}, cwd=workspace.ROOT)
    lines = (proc.stdout + proc.stderr).splitlines()
    fresh = [line for line in lines if line.endswith("sources up-to-date, skipping")]
    for line in lines:
        if line not in fresh:
            print(line)
    # mise keeps the success marker of a task without declared outputs where a copied state directory cannot see it
    print(f"[plan] {len(fresh)} task(s) up to date; tasks without declared outputs (test:*, verify) are always listed")
    return proc.returncode


def main(argv: list[str]) -> int:
    if not argv:
        raise SystemExit(__doc__)
    cmd, args = argv[0], argv[1:]
    if cmd == "jar" and len(args) == 2:
        print(newest_jar(Path(args[0]), args[1]).resolve())
    elif cmd == "install" and len(args) >= 3:
        jar = newest_jar(Path(args[0]), args[1])
        for line in install(jar, args[1], [Path(s) for s in args[2:]]):
            print(line)
    elif cmd == "addon-mods" and len(args) == 1:
        print(" ".join(addon_mods(args[0])))
    elif cmd == "adopt":
        outputs, command = split_command(args)
        return adopt(outputs, command)
    elif cmd == "report":
        report, command = split_command(args)
        if len(report) != 1:
            raise SystemExit("expected: report REPORT -- CMD...")
        return run_with_report(Path(report[0]), command)
    elif cmd == "doctor" and not args:
        return doctor()
    elif cmd == "plan":
        return plan(args)
    else:
        raise SystemExit(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
