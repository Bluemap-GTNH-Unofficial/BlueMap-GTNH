"""The workspace the pipeline runs in: its root, the pack version, its repositories and their git state."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

ROOT = Path(os.environ.get("BMGTNH_WORKSPACE") or Path(__file__).resolve().parent.parent)
PACK_VERSION = os.environ.get("BMGTNH_PACK_VERSION") or "2.9.0"

# name -> directory relative to ROOT; "umbrella" is the workspace root itself (its submodules are diffed on their own)
REPOS = {
    "umbrella": ".",
    "BlueMap": "BlueMap",
    "gtnh-exporter": "gtnh-exporter",
    "harness": "harness",
    "orchestrator": "orchestrator",
    "e2e": "e2e",
    "modernity": "modernity",
}


def git(repo: str, *args: str, check: bool = True) -> str:
    proc = subprocess.run(["git", "-C", str(ROOT / REPOS[repo]), *args], capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} in {REPOS[repo]}: {proc.stderr.strip()}")
    return proc.stdout.strip() if proc.returncode == 0 else ""


def upstream(repo: str) -> str | None:
    """The upstream tracking branch of the checked-out branch, else origin's default branch, else None."""
    for ref in ("@{upstream}", "origin/HEAD"):
        name = git(repo, "rev-parse", "--abbrev-ref", "--symbolic-full-name", ref, check=False)
        if name:
            return name
    return None


def changed_files(repo: str, base: str) -> list[str]:
    """Workspace-relative paths changed in ``repo`` since its merge base with ``base``: committed, staged, unstaged
    and untracked (not ignored) files. Submodule pointers of the umbrella are left out."""
    merge_base = git(repo, "merge-base", base, "HEAD")
    names = git(repo, "diff", "--name-only", "--no-renames", "--ignore-submodules=all", merge_base).splitlines()
    names += git(repo, "ls-files", "--others", "--exclude-standard").splitlines()
    prefix = "" if REPOS[repo] == "." else REPOS[repo] + "/"
    return sorted({prefix + n for n in names if n})
