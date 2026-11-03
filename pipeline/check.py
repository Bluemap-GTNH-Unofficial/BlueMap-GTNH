#!/usr/bin/env python3
"""`mise run check`: run only the checks the current changes need.

Collects the changed files of every repository of the workspace (against each one's upstream tracking branch, or
--base), maps each to the first matching rule of pipeline/affected.toml and runs the union:

1. the mise tasks of those rules (unit suites, builds; mise skips one whose sources are unchanged since it passed),
2. for the affected scenes, after `mise run build-fork`: the BlueMap side of the world oracle against the cached
   client references (`e2e oracle world --all --scene ... --no-capture`: never starts a client; e2e keeps only the
   scenes with oracle cameras and a dump) and the e2e regression views of the scenes that have baselines
   (`e2e run --no-build`).

    mise run check                      everything the changes need
    mise run check --plan               print the plan, run nothing
    mise run check --repo BlueMap       only the changes of these repositories (repeatable)
    mise run check --files a b ...      map these workspace-relative paths instead of asking git
    mise run check --base origin/main   diff every repository against REV instead of its upstream
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import tomllib
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

sys.path.insert(0, str(Path(__file__).resolve().parent))
import workspace  # noqa: E402

RULES_FILE = Path(__file__).resolve().parent / "affected.toml"
EVERYTHING = ("test",)  # the tasks a file no rule matches runs (with every scene)


@dataclass
class Rule:
    paths: list[str]
    tasks: list[str] = field(default_factory=list)
    scenes: list[str] = field(default_factory=list)
    oracle: list[str] = field(default_factory=list)
    e2e: list[str] = field(default_factory=list)
    note: str | None = None

    def matches(self, path: str) -> bool:
        return any(PurePosixPath(path).full_match(pattern) for pattern in self.paths)


@dataclass
class Plan:
    files: dict[str, Rule | None] = field(default_factory=dict)  # changed file -> its rule (None: unmatched)
    tasks: list[str] = field(default_factory=list)
    oracle: set[str] = field(default_factory=set)  # e2e scene names, "*" = all
    e2e: set[str] = field(default_factory=set)
    notes: list[str] = field(default_factory=list)


def load_rules(path: Path = RULES_FILE) -> list[Rule]:
    data = tomllib.loads(path.read_text(encoding="utf-8"))
    return [Rule(**entry) for entry in data.get("rule", [])]


def plan(files: list[str], rules: list[Rule]) -> Plan:
    result = Plan()
    for path in files:
        rule = next((r for r in rules if r.matches(path)), None)
        result.files[path] = rule
        if rule is None:
            tasks, oracle, e2e, note = list(EVERYTHING), ["*"], ["*"], None
        else:
            stem = PurePosixPath(path).stem
            tasks, note = rule.tasks, rule.note
            oracle = [s.replace("{stem}", stem) for s in rule.scenes + rule.oracle]
            e2e = [s.replace("{stem}", stem) for s in rule.scenes + rule.e2e]
        result.tasks += [t for t in tasks if t not in result.tasks]
        result.oracle.update(oracle)
        result.e2e.update(e2e)
        if note and note not in result.notes:
            result.notes.append(note)
    return result


# ---------------------------------------------------------------- scenes the oracle and e2e can run


def e2e_scenes() -> list[str]:
    return sorted(p.stem for p in (workspace.ROOT / "e2e" / "scenes").glob("*.yaml"))


def oracle_variants(scenes: set[str]) -> list[str]:
    """The oracle variants ``scenes`` belong to: addons for a scene rendered with the addons export, default and
    modernity for the others. e2e itself keeps, per variant, only the scenes of its ``--all`` set (cameras, dump)."""
    variants = []
    for name in sorted(scenes):
        spec = (workspace.ROOT / "e2e" / "scenes" / f"{name}.yaml").read_text(encoding="utf-8")
        for v in (["addons"] if "{addons_export}" in spec else ["default", "modernity"]):
            if v not in variants:
                variants.append(v)
    return variants


def baseline_scenes(scenes: set[str]) -> tuple[list[str], list[str]]:
    """``scenes`` split into those with local e2e baselines and those without (they would fail without one)."""
    baselines = workspace.ROOT / f"baselines-{workspace.PACK_VERSION}"
    have = [s for s in sorted(scenes) if (baselines / s).is_dir()]
    return have, [s for s in sorted(scenes) if s not in have]


def expand(scenes: set[str]) -> set[str]:
    known = set(e2e_scenes())
    if "*" in scenes:
        return known
    unknown = scenes - known
    if unknown:
        raise SystemExit(f"affected.toml names unknown e2e scenes: {', '.join(sorted(unknown))}")
    return scenes


# ---------------------------------------------------------------- changed files


def changed(repos: list[str], base: str | None) -> list[str]:
    files = []
    for repo in repos:
        ref = base or workspace.upstream(repo)
        if ref is None:
            print(f"[check] {repo}: no upstream branch, skipped (use --base)", file=sys.stderr)
            continue
        try:
            found = workspace.changed_files(repo, ref)
        except RuntimeError as e:
            raise SystemExit(f"[check] {e}") from None
        print(f"[check] {repo}: {len(found)} changed file(s) since {ref}")
        files += found
    return files


# ---------------------------------------------------------------- running


CALIBRATION_SCENE = "vanilla-zoo"  # with variant default, the pair e2e computes the world calibration from


def world_calibrations() -> list[Path]:
    """World calibrations e2e stored for reference sets (`out/oracle-ref/<pack>/calibration/world-<key>.json`)."""
    return list((workspace.ROOT / "out" / "oracle-ref" / workspace.PACK_VERSION / "calibration").glob("world-*.json"))


def commands(p: Plan) -> list[tuple[str, list[str]]]:
    """(label, argv) of every step of the plan, in order."""
    steps = [(f"mise run {t}", ["mise", "run", t]) for t in p.tasks]
    oracle = sorted(expand(p.oracle)) if p.oracle else []
    e2e, _ = baseline_scenes(expand(p.e2e)) if p.e2e else ([], [])
    if (oracle or e2e) and "build-fork" not in p.tasks:
        steps.append(("mise run build-fork", ["mise", "run", "build-fork"]))
    if oracle:
        variants = oracle_variants(set(oracle))
        if "default" in variants and CALIBRATION_SCENE not in oracle and not world_calibrations():
            oracle.append(CALIBRATION_SCENE)  # e2e can only judge a run without a stored calibration if it has one
        argv = ["uv", "run", "--directory", "e2e", "e2e", "oracle", "world",
                *[a for v in variants for a in ("--variant", v)], "--all",
                *[a for s in oracle for a in ("--scene", s)], "--no-build", "--no-capture"]
        steps.append((f"oracle {'+'.join(variants)}: {' '.join(oracle)}", argv))
    if e2e:
        steps.append((f"e2e: {' '.join(e2e)}", ["uv", "run", "--directory", "e2e", "e2e", "run", "--no-build", *e2e]))
    return steps


def describe(rule: Rule | None) -> str:
    if rule is None:
        return "no rule: runs everything"
    parts = [", ".join(rule.tasks)] if rule.tasks else []
    for key in ("scenes", "oracle", "e2e"):
        if getattr(rule, key):
            parts.append(f"{key} {', '.join(getattr(rule, key))}")
    return "; ".join(parts) or "nothing to run"


def print_plan(p: Plan) -> None:
    unmatched = [f for f, r in p.files.items() if r is None]
    print(f"[check] {len(p.files)} changed file(s), {len(unmatched)} without a rule in {RULES_FILE.name}")
    for f, rule in p.files.items():
        print(f"[check]   {f}: {describe(rule)}")
    if p.e2e:
        _, missing = baseline_scenes(expand(p.e2e))
        if missing:
            print(f"[check] e2e: no baselines, left out: {', '.join(missing)}")
    steps = commands(p)
    print("[check] plan:" if steps else "[check] plan: nothing to run")
    for label, _ in steps:
        print(f"[check]   {label}")
    for note in p.notes:
        print(f"[check] note: {note}")


def run(p: Plan) -> int:
    results = []
    for label, argv in commands(p):
        print(f"[check] >>> {label}", flush=True)
        rc = subprocess.call(argv, cwd=workspace.ROOT)
        results.append((label, rc))
    print("[check] results:")
    for label, rc in results:
        print(f"[check]   {'ok  ' if rc == 0 else 'FAIL'} {label}")
    for note in p.notes:
        print(f"[check] note: {note}")
    return 0 if all(rc == 0 for _, rc in results) else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="mise run check", description=__doc__.split("\n\n")[0])
    parser.add_argument("--base", help="git revision to diff every repository against (default: its upstream)")
    parser.add_argument("--repo", action="append", choices=list(workspace.REPOS), help="only these repositories")
    parser.add_argument("--files", nargs="+", metavar="PATH", help="workspace-relative paths instead of git changes")
    parser.add_argument("--plan", action="store_true", help="print the plan and exit")
    args = parser.parse_args(argv)
    files = args.files if args.files else changed(args.repo or list(workspace.REPOS), args.base)
    p = plan(files, load_rules())
    print_plan(p)
    if args.plan:
        return 0
    return run(p)


if __name__ == "__main__":
    sys.exit(main())
