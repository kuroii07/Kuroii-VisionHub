from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE_FILES = [
    ROOT / "src/ui/App.tsx",
    ROOT / "src/ui/GeneratePage.tsx",
    ROOT / "src/ui/InspirationPage.tsx",
    ROOT / "src/ui/styles.css",
    ROOT / "src/i18n/index.ts",
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
    suspicious = ["?" * 3, "?" * 4, "\ufffd", "\u6d93", "\u9365", "\u675e", "\u9422", "?" * 5]
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
    history_idx = app.find("settings.promptHistory")
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


def assert_i18n_baseline() -> None:
    app = (ROOT / "src/ui/App.tsx").read_text(encoding="utf-8")
    i18n = (ROOT / "src/i18n/index.ts").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8").lower()
    checks = {
        "i18n dictionary exists": "export const messages" in i18n and "zh-CN" in i18n and "en-US" in i18n,
        "typed translator exists": "export type Translator" in i18n and "createTranslator" in i18n,
        "app shell uses translator": "createTranslator(appSettings.language)" in app,
        "navigation uses i18n keys": "t('nav.home')" in app and "t('nav.settings')" in app,
        "workspace home uses translator prop": "function WorkspaceHomePage(props" in app and "t: Translator" in app and "props.t('home.title')" in app,
        "settings entry uses translator prop": "function SettingsPage(props" in app and "props.t('settings.title')" in app,
        "inspiration page receives translator": "<InspirationPage" in app and "t={props.t}" in app,
        "inspiration source i18n migrated": "inspiration.source.searchLabel" in i18n and "inspiration.source.editorEditTitle" in i18n,
        "inspiration asset i18n migrated": "inspiration.asset.searchLabel" in i18n and "inspiration.asset.reverseConfigNote" in i18n,
        "user content translation boundary documented": "user prompts" in readme or "?? prompt" in readme,
    }
    missing = [name for name, ok in checks.items() if not ok]
    if missing:
        fail("Missing i18n baseline checks: " + ", ".join(missing))



def assert_english_i18n_layout_guards() -> None:
    css = (ROOT / "src/ui/styles.css").read_text(encoding="utf-8")
    app = (ROOT / "src/ui/App.tsx").read_text(encoding="utf-8")
    i18n = (ROOT / "src/i18n/index.ts").read_text(encoding="utf-8")
    required_css = [
        '.appShell[data-language="en-US"] .workspaceGenerate',
        '.appShell[data-language="en-US"] .workspaceGenerate .quickToolbar',
        '.appShell[data-language="en-US"] .workspaceGenerate .promptActions',
        '.appShell[data-language="en-US"] .workspaceGenerate .promptControlRow',
        '.appShell[data-language="en-US"] .workspaceGenerate .promptActions .chipButton',
        '.appShell[data-language="en-US"] .workspaceGenerate .studioSelectValue',
        '[data-language="en-US"] .promptExcerptShell',
        '[data-language="en-US"] .promptExcerptActions .miniButton',
        'overflow-wrap: anywhere',
        'text-overflow: ellipsis',
        'word-break: break-word',
    ]
    missing_css = [token for token in required_css if token not in css]
    if missing_css:
        fail("Missing English i18n layout CSS guards: " + ", ".join(missing_css))
    if 'data-language={appSettings.language}' not in app:
        fail("App shell does not expose data-language for language-specific layout guards")
    long_english_terms = [
        "Redraw from reference",
        "Multi-model compare",
        "Open detailed polish window",
        "Relay / aggregate API",
        "Current model",
        "Prompt excerpts",
        "From clipboard",
        "No prompt excerpts yet",
    ]
    missing_terms = [term for term in long_english_terms if term not in i18n]
    if missing_terms:
        fail("Missing long English i18n fixture terms: " + ", ".join(missing_terms))


def assert_empty_and_error_states_exist() -> None:
    app = (ROOT / "src/ui/App.tsx").read_text(encoding="utf-8")
    generate = (ROOT / "src/ui/GeneratePage.tsx").read_text(encoding="utf-8")
    inspiration = (ROOT / "src/ui/InspirationPage.tsx").read_text(encoding="utf-8")
    checks = {
        "library empty state": "libraryEmpty" in app and "library.empty.noImagesTitle" in app and "library.empty.noMatchesTitle" in app,
        "batch queue empty state": "batch.emptyQueueTitle" in app and "batch.emptyTitle" in app,
        "provider profile empty state": "provider.noProfilesTitle" in app and "provider.noProfilesHint" in app,
        "generation failure diagnostics": "diagnoseGenerationFailure" in generate,
        "inspiration empty state": "empty" in inspiration.lower() and ("inspiration.source.emptyTitle" in inspiration or "inspiration.asset.emptyTitle" in inspiration or "inspiration.excerpt.emptyTitle" in inspiration),
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
    assert_i18n_baseline()
    assert_english_i18n_layout_guards()
    assert_empty_and_error_states_exist()
    print("UI QA check passed: accessibility names, prompt-tool separation, i18n baseline, English layout guards, long-text/large-data performance guards, empty/error states, and mojibake scan are OK.")


if __name__ == "__main__":
    main()
