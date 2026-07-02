from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE_FILES = [
    ROOT / "src/ui/App.tsx",
    ROOT / "src/ui/GeneratePage.tsx",
    ROOT / "src/ui/InspirationPage.tsx",
    ROOT / "src/ui/styles.css",
]
BUTTON_FILES = [
    ROOT / "src/ui/App.tsx",
    ROOT / "src/ui/GeneratePage.tsx",
    ROOT / "src/ui/InspirationPage.tsx",
]
ICON_BUTTON_CLASS_RE = re.compile(
    r'className=\{?`?[^\n>]*(?:iconButton|iconMiniButton|workspaceIconAction|promptAssistClose|dangerMiniButton|imagePreviewNav|imagePreviewClose)[^\n>]*',
    re.IGNORECASE,
)
BUTTON_TAG_RE = re.compile(r"<button\b(?P<attrs>[^>]*)>", re.IGNORECASE | re.DOTALL)


def fail(message: str) -> None:
    raise AssertionError(message)


def line_number(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def assert_no_mojibake_or_placeholders() -> None:
    suspicious = ["?" * 4, "\ufffd", "\u6d93", "\u9365", "\u675e", "\u9422", "?" * 5]
    for path in CORE_FILES:
        text = path.read_text(encoding="utf-8")
        for term in suspicious:
            if term in text:
                fail(f"Suspicious mojibake/placeholder {term!r} in {path.relative_to(ROOT)}")


def assert_icon_buttons_have_accessible_names() -> None:
    for path in BUTTON_FILES:
        text = path.read_text(encoding="utf-8")
        for match in BUTTON_TAG_RE.finditer(text):
            start = match.start()
            end = text.find("</button>", start)
            button_source = text[start:end if end != -1 else start + 800]
            if not ICON_BUTTON_CLASS_RE.search(button_source[:500]):
                continue
            has_name = any(token in button_source[:900] for token in ["aria-label=", "title=", "data-tooltip="])
            if not has_name:
                fail(
                    f"Icon-only button missing aria-label/title/data-tooltip in "
                    f"{path.relative_to(ROOT)}:{line_number(text, start)}"
                )


def assert_long_text_css_guards() -> None:
    css = (ROOT / "src/ui/styles.css").read_text(encoding="utf-8")
    required_selectors = [
        ".settingsRowMain small",
        ".profileMain",
        ".libraryDetailSection.promptDetailSection p",
        ".promptExcerptText",
        ".promptExcerptMeta span",
        ".promptTemplatePreview textarea",
        ".providerConfigHeader small",
        ".localDiagnosticMessage",
        ".promptToolsHero small",
        ".promptToolCardHeader small",
        ".settingsConfigGrid input",
        ".settingsConfigGrid textarea",
        ".promptPolishConfigInstances button small",
        ".inspirationDetailDrawer .reversePromptBlock",
    ]
    for selector in required_selectors:
        if selector not in css:
            fail(f"Long-text guard selector missing from styles.css: {selector}")
    for token in ["overflow-wrap: anywhere", "min-width: 0", "text-overflow: ellipsis"]:
        if token not in css:
            fail(f"Global long-text CSS token missing: {token}")


def assert_incremental_rendering_guards() -> None:
    inspiration = (ROOT / "src/ui/InspirationPage.tsx").read_text(encoding="utf-8")
    checks = {
        "asset incremental render": "ASSET_INITIAL_RENDER_COUNT" in inspiration and "visibleAssets" in inspiration,
        "excerpt incremental render": "EXCERPT_INITIAL_RENDER_COUNT" in inspiration and "visibleExcerpts" in inspiration,
        "large list frame batching": "requestAnimationFrame" in inspiration and "cancelAnimationFrame" in inspiration,
        "search index on demand": "if (!hasSearchQuery) return null" in inspiration and "excerptSearchIndex" in inspiration and "assetSearchIndex" in inspiration,
        "asset meta idle flush": "requestIdleCallback" in inspiration and "queueAssetImageMeta" in inspiration,
    }
    missing = [name for name, ok in checks.items() if not ok]
    if missing:
        fail("Missing performance guards: " + ", ".join(missing))


def assert_large_data_surface_guards() -> None:
    app = (ROOT / "src/ui/App.tsx").read_text(encoding="utf-8")
    inspiration = (ROOT / "src/ui/InspirationPage.tsx").read_text(encoding="utf-8")
    checks = {
        "lazy mount gallery and inspiration pages": "isLibraryPageMounted" in app and "isInspirationPageMounted" in app,
        "library memoized record map": "const libraryRecordMap = useMemo" in app,
        "library memoized filtering": "const filteredItems = useMemo" in app,
        "inspiration asset visible slice": "visibleAssets" in inspiration and "setRenderedAssetCount" in inspiration,
        "inspiration excerpt visible slice": "visibleExcerpts" in inspiration and "setRenderedExcerptCount" in inspiration,
        "prompt excerpt search index": "excerptSearchIndex" in inspiration,
        "asset search index": "assetSearchIndex" in inspiration,
    }
    missing = [name for name, ok in checks.items() if not ok]
    if missing:
        fail("Missing large-data surface guards: " + ", ".join(missing))


def assert_prompt_tool_settings_are_separated() -> None:
    app = (ROOT / "src/ui/App.tsx").read_text(encoding="utf-8")
    history_idx = app.find("提示词与历史")
    tool_group_idx = app.find('className="settingsGroupCard promptToolsGroup"')
    polish_idx = app.find('prompt-polish-tool-title')
    reverse_idx = app.find('image-reverse-tool-title')
    checks = {
        "history section exists": history_idx >= 0,
        "prompt tool group exists": tool_group_idx >= 0,
        "prompt tool group follows history": history_idx >= 0 and tool_group_idx > history_idx,
        "polish card inside tool group": tool_group_idx >= 0 and polish_idx > tool_group_idx,
        "image reverse card inside tool group": tool_group_idx >= 0 and reverse_idx > tool_group_idx,
        "independent polish credential badge": "prompt-polish:default" in app,
        "independent image reverse credential badge": "image-reverse:default" in app,
    }
    missing = [name for name, ok in checks.items() if not ok]
    if missing:
        fail("Prompt tool settings are not separated cleanly: " + ", ".join(missing))


def assert_empty_and_error_states_exist() -> None:
    app = (ROOT / "src/ui/App.tsx").read_text(encoding="utf-8")
    generate = (ROOT / "src/ui/GeneratePage.tsx").read_text(encoding="utf-8")
    inspiration = (ROOT / "src/ui/InspirationPage.tsx").read_text(encoding="utf-8")
    checks = {
        "library empty state": "libraryEmpty" in app and ("\\u8fd8\\u6ca1\\u6709\\u672c\\u5730\\u56fe\\u7247" in app or "\\u6ca1\\u6709\\u7b26\\u5408\\u6761\\u4ef6\\u7684\\u8bb0\\u5f55" in app),
        "batch queue empty state": "\u8fd9\u4e2a\u961f\u5217\u8fd8\u6ca1\u6709\u4efb\u52a1" in app,
        "provider profile empty state": "\u8fd8\u6ca1\u6709\u914d\u7f6e" in app,
        "generation failure diagnostics": "diagnoseGenerationFailure" in generate,
        "inspiration empty state": "empty" in inspiration.lower() and ("\u6ca1\u6709" in inspiration or "\u6682\u65e0" in inspiration),
    }
    missing = [name for name, ok in checks.items() if not ok]
    if missing:
        fail("Missing empty/error state checks: " + ", ".join(missing))

def main() -> None:
    assert_no_mojibake_or_placeholders()
    assert_icon_buttons_have_accessible_names()
    assert_long_text_css_guards()
    assert_incremental_rendering_guards()
    assert_large_data_surface_guards()
    assert_prompt_tool_settings_are_separated()
    assert_empty_and_error_states_exist()
    print("UI QA check passed: accessibility names, prompt-tool separation, long-text/large-data performance guards, empty/error states, and mojibake scan are OK.")


if __name__ == "__main__":
    main()
