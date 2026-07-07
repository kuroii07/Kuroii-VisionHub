#!/usr/bin/env python3
"""Release-candidate consistency checks for VisionHub Studio.

This script is intentionally read-only. It verifies version consistency and
repository hygiene before a release-candidate build without touching AppData,
user images, credentials, or generated history.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8", errors="replace")


def fail(message: str) -> None:
    print(f"Release candidate check failed: {message}", file=sys.stderr)
    raise SystemExit(1)


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def match_version(path: str, pattern: str, label: str) -> str:
    match = re.search(pattern, read_text(path), re.MULTILINE)
    if not match:
        fail(f"Could not find {label} in {path}")
    return match.group(1)


def check_versions() -> str:
    package = json.loads(read_text("package.json"))
    version = package.get("version")
    require(isinstance(version, str) and version, "package.json version is missing")

    lock = json.loads(read_text("package-lock.json"))
    lock_root = lock.get("version")
    lock_package = lock.get("packages", {}).get("", {}).get("version")

    checks = {
        "package-lock root": lock_root,
        "package-lock package": lock_package,
        "Cargo.toml": match_version("src-tauri/Cargo.toml", r'^version\s*=\s*"([^"]+)"', "Cargo.toml version"),
        "Cargo.lock": match_version("src-tauri/Cargo.lock", r'name\s*=\s*"visionhub-studio"\s*\nversion\s*=\s*"([^"]+)"', "Cargo.lock visionhub-studio version"),
        "tauri.conf.json": json.loads(read_text("src-tauri/tauri.conf.json")).get("version"),
        "App.tsx APP_VERSION": match_version("src/ui/App.tsx", r"const APP_VERSION\s*=\s*'([^']+)';", "APP_VERSION"),
        "development plan current version": match_version("docs/visionhub-development-plan.md", r'Current app version:\s*`([^`]+)`', "development plan current version"),
    }

    for label, value in checks.items():
        require(value == version, f"{label} is {value!r}, expected {version!r}")

    readme = read_text("README.md")
    require(f"Current checkpoint: `{version}`" in readme, "README current checkpoint does not match package version")
    require(f"### v{version}" in readme, "README recent update section is missing the current version")
    return version


def git_ls_files() -> list[str]:
    try:
        result = subprocess.run(
            ["git", "ls-files"],
            cwd=ROOT,
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        fail(f"git ls-files failed: {exc}")
    return [line.strip().replace("\\", "/") for line in result.stdout.splitlines() if line.strip()]


def check_repository_hygiene() -> None:
    tracked = git_ls_files()
    forbidden_prefixes = (
        "node_modules/",
        "dist/",
        "src-tauri/target/",
        "outputs/",
        "AppData/",
    )
    forbidden_suffixes = (
        ".exe",
        ".msi",
        ".blockmap",
        ".log",
    )
    forbidden_names = {
        ".env",
        ".env.local",
        "api-key.txt",
        "apikey.txt",
        "secrets.json",
    }

    bad_paths: list[str] = []
    for path in tracked:
        name = Path(path).name.lower()
        lower = path.lower()
        if lower.startswith(forbidden_prefixes):
            bad_paths.append(path)
        elif lower.endswith(forbidden_suffixes):
            bad_paths.append(path)
        elif name in forbidden_names:
            bad_paths.append(path)

    require(not bad_paths, "tracked build/private artifacts found: " + ", ".join(bad_paths[:20]))


def main() -> None:
    version = check_versions()
    check_repository_hygiene()
    print(f"Release candidate check passed: version {version} is consistent and tracked repository hygiene is OK.")


if __name__ == "__main__":
    main()
