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
    steps.py shell SCRIPT                       the shell of every task (mise.toml `task_config.shell`), see below
    steps.py timings [--runs N] [--all]         wall-clock summary of the last N recorded `mise run`s (default 1)

`adopt` is how `mise run adopt` records the outputs already in the workspace as current without producing them again
(the first run of a task with sources always runs it, because mise has no record of it yet).

`shell` runs each command of a task with `bash -o errexit -o pipefail -c`. Before that it takes the workspace locks
the task names in BMGTNH_TASK_LOCKS (space-separated, `WS/locks/<name>.lock`, e.g. `gradle-BlueMap`: one Gradle build
per source tree at a time), printing the holder while it waits (BMGTNH_TASK_LOCK_WAIT=<seconds> bounds the wait, `0`
fails at once). BMGTNH_TASK_NICE=<n> runs the command with `nice -n <n>`: a task off the critical path leaves the CPU
to the others whenever both want it. Afterwards it appends one line per command to out/pipeline/timings.ndjson: task,
start, seconds, lock wait, exit status, the `mise run` it belongs to (`run`, `mise`), the machine's CPU use meanwhile
(`cpu`, Linux) and the command. The command's stderr passes through this shell line by line, so the GTNH client lock
the launcher takes inside the command (its `[lock] client lock acquired after Ns` line) counts as lock wait too
(`client_wait`: that part). BMGTNH_TIMINGS=0 records nothing.
"""

from __future__ import annotations

import contextlib
import filecmp
import glob
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
from datetime import datetime
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

    mise 2026.10.21 recorded a dry run in content-hash mode (`task.source_freshness_hash_contents`) as if the tasks had
    succeeded, so a plain `mise run -n` marked stale tasks up to date without running them. 2026.10.25 no longer does:
    after `mise run -n all`, a real `mise run all` on the same state still ran every stale task (2026-11-05). The copy
    keeps the dry run away from the real state on either version (min_version is 2026.10.4)."""
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


# ---------------------------------------------------------------- task shell: locks and timings

LOCKS_ENV = "BMGTNH_TASK_LOCKS"
LOCK_WAIT_ENV = "BMGTNH_TASK_LOCK_WAIT"
NICE_ENV = "BMGTNH_TASK_NICE"
TIMINGS = Path("out") / "pipeline" / "timings.ndjson"  # under the workspace root
POLL_SECONDS = 1.0


class LockBusy(Exception):
    """A task lock is held by another process and the wait bound (BMGTNH_TASK_LOCK_WAIT) ran out."""


def read_holder(path: Path) -> dict | None:
    try:
        text = path.read_text(encoding="utf-8").strip()
        return json.loads(text) if text else None
    except (OSError, ValueError):
        return None


def describe_holder(holder: dict | None) -> str:
    if not holder:
        return "an unknown process (no holder record yet)"
    return f"pid {holder.get('pid')} ({holder.get('command')}, since {holder.get('started')})"


@contextlib.contextmanager
def task_lock(name: str, describe: str, wait: float | None = None):
    """Holds ``WS/locks/<name>.lock`` (flock, released by the kernel when the holder exits) for the ``with`` block,
    the same scheme as the launcher's client lock and the orchestrator's server locks. ``wait``: seconds to wait for a
    busy lock (None: forever, 0: raise ``LockBusy`` at once)."""
    import fcntl

    path = workspace.ROOT / "locks" / f"{name}.lock"
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_RDWR | os.O_CREAT, 0o644)  # not inherited: a Gradle daemon started below does not keep it
    try:
        started = time.monotonic()
        reported = None
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                holder = describe_holder(read_holder(path))
                if wait is not None and time.monotonic() - started >= wait:
                    raise LockBusy(f"lock {path} is held by {holder}") from None
                if holder != reported:
                    print(f"[lock] {name} is held by {holder}; waiting", file=sys.stderr, flush=True)
                    reported = holder
                time.sleep(POLL_SECONDS)
        if reported is not None:
            print(f"[lock] {name} acquired after {time.monotonic() - started:.0f}s", file=sys.stderr, flush=True)
        record = {"pid": os.getpid(), "host": socket.gethostname(), "command": describe,
                  "started": time.strftime("%Y-%m-%dT%H:%M:%S%z")}
        os.ftruncate(fd, 0)
        os.pwrite(fd, (json.dumps(record) + "\n").encode("utf-8"), 0)
        try:
            yield path
        finally:
            os.ftruncate(fd, 0)
            fcntl.flock(fd, fcntl.LOCK_UN)
    finally:
        os.close(fd)


def mise_run() -> tuple[str, str | None]:
    """The `mise run` this task command belongs to (mise is the parent process): an id from its pid and, on Linux,
    its start time, and its command line."""
    ppid = os.getppid()
    try:
        start = Path(f"/proc/{ppid}/stat").read_text().rsplit(")", 1)[1].split()[19]
        cmdline = Path(f"/proc/{ppid}/cmdline").read_bytes().rstrip(b"\0").replace(b"\0", b" ").decode(errors="replace")
        return f"{ppid}-{start}", cmdline
    except (OSError, IndexError):
        return str(ppid), None


def record_timing(entry: dict) -> None:
    path = workspace.ROOT / TIMINGS
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:  # one short append per line: concurrent tasks do not interleave
        f.write(json.dumps(entry) + "\n")


# printed by the launcher (gtnh_client/lock.py), also when it runs on the Windows host behind the bridge
CLIENT_WAIT = re.compile(rb"\[lock\] client lock acquired after (\d+(?:\.\d+)?)s")


def relay_stderr(stream, client_waits: list[float]) -> None:
    """Passes the command's stderr on line by line as it comes (fd 2, unbuffered) and collects the launcher's client
    lock waits from it: that lock is taken inside the command, not by this shell."""
    for line in iter(stream.readline, b""):
        os.write(2, line)
        if m := CLIENT_WAIT.search(line):
            client_waits.append(float(m.group(1)))
    stream.close()


def cpu_ticks() -> tuple[int, int] | None:
    """Idle and total CPU time of the whole machine so far (Linux /proc/stat, in clock ticks), None elsewhere."""
    try:
        fields = [int(v) for v in Path("/proc/stat").read_text().split("\n", 1)[0].split()[1:9]]
    except (OSError, ValueError):
        return None
    return fields[3] + fields[4], sum(fields)  # idle + iowait; user .. steal (guest time is inside user)


def busy_share(before: tuple[int, int] | None, after: tuple[int, int] | None) -> float | None:
    """Share of the machine's CPU time that was not idle between two `cpu_ticks` readings."""
    if before is None or after is None or after[1] <= before[1]:
        return None
    return round(1 - (after[0] - before[0]) / (after[1] - before[1]), 3)


def shell(script: str, env: dict[str, str] | None = None) -> int:
    """Runs one command of a task (see the module doc): locks, ``bash -o errexit -o pipefail -c``, timings line."""
    env = os.environ if env is None else env
    task = env.get("MISE_TASK_NAME", "?")
    locks = env.get(LOCKS_ENV, "").split()
    wait_bound = env.get(LOCK_WAIT_ENV, "").strip()
    nice = env.get(NICE_ENV, "").strip()
    command = ["bash", "-o", "errexit", "-o", "pipefail", "-c", script]
    if nice:
        command = ["nice", "-n", nice, *command]
    child: list[subprocess.Popen] = []

    def on_signal(signum, _frame):
        # mise stops a task (timeout, Ctrl-C, a failed sibling) by signalling its process group; pass it on to the
        # command in case only this process got it, and record the exit once the command is gone
        if child and child[0].poll() is None:
            child[0].send_signal(signum)
        else:
            raise SystemExit(128 + signum)

    previous = {sig: signal.signal(sig, on_signal) for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP)}
    start, t0 = time.time(), time.monotonic()
    waited = 0.0
    client_waits: list[float] = []
    ticks = None
    rc: int | str = "?"
    try:
        with contextlib.ExitStack() as held:
            for name in locks:
                held.enter_context(task_lock(name, f"mise task {task}", float(wait_bound) if wait_bound else None))
            waited = time.monotonic() - t0
            ticks = cpu_ticks()
            child.append(subprocess.Popen(command, stderr=subprocess.PIPE))
            relay = threading.Thread(target=relay_stderr, args=(child[0].stderr, client_waits), daemon=True)
            relay.start()
            rc = child[0].wait()
            relay.join(timeout=5)
            rc = 128 - rc if rc < 0 else rc
    except LockBusy as e:
        print(f"[lock] {e}", file=sys.stderr, flush=True)
        rc = 75
    except SystemExit as e:
        rc = e.code if isinstance(e.code, int) else 1
    finally:
        if env.get("BMGTNH_TIMINGS", "1") != "0":
            run, mise = mise_run()
            client = round(sum(client_waits), 2)
            entry = {"task": task, "start": datetime.fromtimestamp(start).astimezone().isoformat(timespec="milliseconds"),
                     "seconds": round(time.monotonic() - t0, 2), "wait": round(waited + client, 2), "client_wait": client,
                     "exit": rc, "run": run, "mise": mise, "cmd": " ".join(script.split())[:200],
                     "cpu": busy_share(ticks, cpu_ticks())}
            with contextlib.suppress(OSError):
                record_timing(entry)
    for sig, handler in previous.items():
        signal.signal(sig, handler)
    return rc if isinstance(rc, int) else 1


def load_timings(path: Path) -> list[dict]:
    entries = []
    if path.is_file():
        for line in path.read_text(encoding="utf-8").splitlines():
            with contextlib.suppress(ValueError):
                entries.append(json.loads(line))
    return entries


def epoch(stamp: str) -> float:
    return datetime.fromisoformat(stamp).timestamp()


def task_order() -> dict[str, set[str]]:
    """Every task's `depends` and `wait_for` (mise.toml and pipeline/tasks/*.toml of this checkout), names only."""
    import tomllib

    here = Path(__file__).resolve().parent
    tasks = tomllib.loads((here.parent / "mise.toml").read_text(encoding="utf-8")).get("tasks", {})
    for f in sorted((here / "tasks").glob("*.toml")):
        tasks |= tomllib.loads(f.read_text(encoding="utf-8"))

    def names(entries) -> set[str]:
        entries = [entries] if isinstance(entries, str) else entries
        return {(e if isinstance(e, str) else e[0] if isinstance(e, list) else e["task"]).split()[0] for e in entries}

    return {name: names(t.get("depends", [])) | names(t.get("wait_for", [])) for name, t in tasks.items()}


def summarize_run(entries: list[dict], order: dict[str, set[str]]) -> dict:
    """One `mise run`: its tasks (commands of a task merged) with start and end offsets, wall clock, summed task time
    and the critical path: from the task that ended last, back through the task it waited for (`depends`, `wait_for`,
    also through tasks that did not run) that ended last before it started its own work (after its lock wait)."""
    t0 = min(epoch(e["start"]) for e in entries)
    tasks: dict[str, dict] = {}
    for e in entries:
        begin = epoch(e["start"]) - t0
        t = tasks.setdefault(e["task"], {"task": e["task"], "start": begin, "end": 0.0, "seconds": 0.0, "wait": 0.0,
                                         "exit": 0, "work": begin + e.get("wait", 0.0), "cpu_time": 0.0, "cpu_of": 0.0})
        t["start"] = min(t["start"], begin)
        t["end"] = max(t["end"], begin + e["seconds"])
        t["seconds"] += e["seconds"]
        t["wait"] += e.get("wait", 0.0)
        t["exit"] = t["exit"] or e["exit"]
        if e.get("cpu") is not None:  # machine busy share while the command ran, weighted by its time
            t["cpu_time"] += e["cpu"] * e["seconds"]
            t["cpu_of"] += e["seconds"]
    for t in tasks.values():
        t["cpu"] = t["cpu_time"] / t["cpu_of"] if t["cpu_of"] else None

    def waited_for(name: str) -> set[str]:
        seen, todo = set(), list(order.get(name, ()))
        while todo:
            n = todo.pop()
            if n not in seen:
                seen.add(n)
                todo.extend(order.get(n, ()))
        return seen

    wall = max(t["end"] for t in tasks.values())
    path, current = [], max(tasks.values(), key=lambda t: t["end"])
    while current is not None:
        path.append(current["task"])
        before = [tasks[n] for n in waited_for(current["task"]) if n in tasks and tasks[n]["end"] <= current["work"] + 1.0]
        current = max(before, key=lambda t: t["end"]) if before else None
    return {"started": entries[0]["start"], "mise": entries[0].get("mise"), "wall": wall,
            "busy": sum(t["seconds"] for t in tasks.values()), "tasks": sorted(tasks.values(), key=lambda t: -t["seconds"]),
            "critical": path[::-1]}


def timings(args: list[str], path: Path | None = None) -> int:
    """`mise run timings`: the last recorded `mise run`s, slowest task first."""
    runs_wanted = 1
    if args[:1] == ["--runs"] and len(args) == 2:
        runs_wanted = int(args[1])
    elif args == ["--all"]:
        runs_wanted = 0
    elif args:
        raise SystemExit("expected: timings [--runs N] [--all]")
    entries = load_timings(path or workspace.ROOT / TIMINGS)
    runs: dict[str, list[dict]] = {}
    for e in entries:
        runs.setdefault(e.get("run", "?"), []).append(e)
    if not runs:
        print(f"[timings] nothing recorded yet in {TIMINGS}")
        return 0
    order = task_order()
    for entries in list(runs.values())[-runs_wanted if runs_wanted else 0:]:
        s = summarize_run(entries, order)
        failed = sum(1 for t in s["tasks"] if t["exit"] != 0)
        print(f"[timings] {s['started']} {s['mise'] or ''}".rstrip())
        print(f"[timings]   wall {s['wall']:.1f} s, task time {s['busy']:.1f} s ({s['busy'] / max(s['wall'], 0.01):.1f} "
              f"tasks at a time), {len(s['tasks'])} task(s), {failed} failed")
        print(f"[timings]   {'seconds':>8} {'lock wait':>9} {'start':>8} {'end':>8} {'cpu':>4} {'exit':>4}  task")
        for t in s["tasks"]:
            cpu = f"{t['cpu']:4.0%}" if t["cpu"] is not None else "   -"
            print(f"[timings]   {t['seconds']:8.1f} {t['wait']:9.1f} {t['start']:+8.1f} {t['end']:+8.1f} {cpu} "
                  f"{t['exit']!s:>4}  {t['task']}")
        print("[timings]   cpu: share of the whole machine's CPU in use while the task ran (all processes)")
        print(f"[timings]   critical path: {' -> '.join(s['critical'])}")
    return 0


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
    elif cmd == "shell" and len(args) == 1:
        return shell(args[0])
    elif cmd == "timings":
        return timings(args)
    else:
        raise SystemExit(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
