#!/usr/bin/env python3
"""Release-candidate consistency checks for Kuroii VisionHub.

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
REQUIRED_TRACKED_FILES = {
    "src/ui/App.tsx",
    "src/ui/AppDialogs.tsx",
    "src/ui/BatchQueuePage.tsx",
    "src/ui/CachedInspirationPage.tsx",
    "src/ui/ComfyUIWorkflowPresentation.tsx",
    "src/ui/FreeGenerationPage.tsx",
    "src/ui/PromptTemplatesPage.tsx",
    "src/ui/ProviderPresentation.tsx",
    "src/ui/SettingsPage.tsx",
    "src/ui/WorkspaceHomePage.tsx",
    "src/ui/library/LibraryPage.tsx",
    "src/services/comfyUIWorkflow.ts",
    "src/services/comfyUIWorkflow.test.ts",
    "src/services/providerCapabilityMatrix.ts",
    "src/services/providerCapabilityMatrix.test.ts",
    "src/services/providerServiceCatalog.ts",
    "src/services/providerServiceCatalog.test.ts",
    "src/services/providerProfileSelection.ts",
    "src/services/providerProfileSelection.test.ts",
    "src/services/providerDraftPresentation.ts",
    "src/services/providerDraftPresentation.test.ts",
    "src/services/providerConfigValidation.ts",
    "src/services/providerConfigValidation.test.ts",
    "src/services/settingsBackup.ts",
    "src/services/settingsBackup.test.ts",
}


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


def run_git_diff(args: list[str], label: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["git", "diff", *args],
            cwd=ROOT,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        fail(f"git diff {label} failed: {exc}")


def check_git_snapshot() -> None:
    staged = run_git_diff(["--cached", "--quiet"], "staged snapshot")
    unstaged = run_git_diff(["--quiet"], "working tree snapshot")
    require(staged.returncode in (0, 1), f"git diff staged snapshot failed: {staged.stderr.strip()}")
    require(unstaged.returncode in (0, 1), f"git diff working tree snapshot failed: {unstaged.stderr.strip()}")
    require(
        not (staged.returncode == 1 and unstaged.returncode == 1),
        "mixed staged and unstaged tracked changes; stage all changes or unstage all changes before release-candidate validation",
    )


def check_git_whitespace() -> None:
    for label, args in (
        ("working tree", ["--check"]),
        ("staged changes", ["--cached", "--check"]),
    ):
        result = run_git_diff(args, label)
        if result.returncode != 0:
            output = (result.stdout or result.stderr).splitlines()
            diagnostics: list[str] = []
            for line in output:
                match = re.match(
                    r"^(.+):(\d+): (trailing whitespace\.|space before tab in indent\.|new blank line at EOF\.)$",
                    line,
                )
                if match:
                    diagnostics.append(f"{match.group(1)}:{match.group(2)}: {match.group(3)}")
            details = "; ".join(diagnostics)
            if not details:
                details = "git reported a whitespace error"
            fail(f"{label} whitespace check failed: {details}")



TEXT_SCAN_SUFFIXES = {
    ".css",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".lock",
    ".md",
    ".ps1",
    ".py",
    ".rs",
    ".svg",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}

SECRET_PATTERNS = {
    # Do not print matched values. Report only file path and pattern label.
    "openai_like_key": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"),
    "google_api_key": re.compile(r"\bAIza[0-9A-Za-z_-]{20,}\b"),
    "aws_access_key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "long_bearer_token": re.compile(r"(?i)bearer\s+[A-Za-z0-9._-]{24,}"),
}


def check_no_tracked_secret_literals(tracked: list[str]) -> None:
    hits: list[str] = []
    for path in tracked:
        file_path = ROOT / path
        if file_path.suffix.lower() not in TEXT_SCAN_SUFFIXES:
            continue
        try:
            content = file_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(content):
                hits.append(f"{path} ({label})")
                break

    require(not hits, "tracked secret-like literals found: " + ", ".join(hits[:20]))

def check_repository_hygiene() -> None:
    tracked = git_ls_files()
    check_git_snapshot()
    check_git_whitespace()
    missing_tracked = sorted(REQUIRED_TRACKED_FILES.difference(tracked))
    require(not missing_tracked, "required source files are not tracked: " + ", ".join(missing_tracked))
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
        ".zip",
        ".7z",
        ".rar",
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
    check_no_tracked_secret_literals(tracked)


def main() -> None:
    version = check_versions()
    check_repository_hygiene()
    print(f"Release candidate check passed: version {version} is consistent and tracked repository hygiene is OK.")


if __name__ == "__main__":
    main()
