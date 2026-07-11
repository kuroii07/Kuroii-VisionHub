import { Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StorageSettings } from '../services/desktopApi';
import type { Translator } from '../i18n';
import type { ConfirmDialogRequest } from './confirmDialog';

export type ConfirmDialogState = ConfirmDialogRequest & { error?: string };

export type BatchQueueNameDialogState = {
  mode: 'create' | 'rename';
  defaultName: string;
  targetId?: string;
};

type ShortcutGroupDefinition = {
  titleKey: Parameters<Translator>[0];
  items: Array<{ keys: string[]; actionKey: Parameters<Translator>[0] }>;
};

const shortcutGroups: ShortcutGroupDefinition[] = [
  {
    titleKey: 'shortcut.group.global',
    items: [
      { keys: ['Ctrl', '/'], actionKey: 'shortcut.action.openShortcuts' },
      { keys: ['Ctrl', 'B'], actionKey: 'shortcut.action.toggleSidebar' },
      { keys: ['Ctrl', ','], actionKey: 'shortcut.action.openProviders' },
      { keys: ['Ctrl', '0'], actionKey: 'shortcut.action.openHome' },
      { keys: ['Ctrl', '1'], actionKey: 'shortcut.action.openGenerate' },
      { keys: ['Ctrl', '2'], actionKey: 'shortcut.action.openFree' },
      { keys: ['Ctrl', '3'], actionKey: 'shortcut.action.openLibrary' },
      { keys: ['Ctrl', '4'], actionKey: 'shortcut.action.openInspiration' },
      { keys: ['Ctrl', '5'], actionKey: 'shortcut.action.openTemplates' },
      { keys: ['Ctrl', '6'], actionKey: 'shortcut.action.openProviders' },
      { keys: ['Ctrl', '7'], actionKey: 'shortcut.action.openSettings' },
      { keys: ['Ctrl', '8'], actionKey: 'shortcut.action.openBatch' },
      { keys: ['Esc'], actionKey: 'shortcut.action.closeOverlay' }
    ]
  },
  {
    titleKey: 'shortcut.group.generate',
    items: [
      { keys: ['Ctrl', 'Enter'], actionKey: 'shortcut.action.submitGenerate' },
      { keys: ['Ctrl', 'K'], actionKey: 'shortcut.action.focusPrompt' },
      { keys: ['Ctrl', 'Shift', 'R'], actionKey: 'shortcut.action.addReference' },
      { keys: ['Ctrl', 'Shift', 'C'], actionKey: 'shortcut.action.clearReferences' },
      { keys: ['Ctrl', 'Shift', 'I'], actionKey: 'shortcut.action.modeImage' },
      { keys: ['Ctrl', 'Shift', 'T'], actionKey: 'shortcut.action.modeText' }
    ]
  },
  {
    titleKey: 'shortcut.group.libraryData',
    items: [
      { keys: ['Ctrl', 'F'], actionKey: 'shortcut.action.focusLibrarySearch' },
      { keys: ['Ctrl', 'O'], actionKey: 'shortcut.action.openLibraryDir' },
      { keys: ['Ctrl', 'E'], actionKey: 'shortcut.action.exportSettingsBackup' }
    ]
  },
  {
    titleKey: 'shortcut.group.preview',
    items: [
      { keys: ['+'], actionKey: 'shortcut.action.zoomInPreview' },
      { keys: ['-'], actionKey: 'shortcut.action.zoomOutPreview' },
      { keys: ['0'], actionKey: 'shortcut.action.resetPreview' },
      { keys: ['Space'], actionKey: 'shortcut.action.resetPreview' },
      { keys: ['Esc'], actionKey: 'shortcut.action.closePreview' }
    ]
  }
];

export function BatchQueueNameDialog(props: {
  t: Translator;
  mode: 'create' | 'rename';
  defaultName: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(props.defaultName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const title = props.mode === 'rename' ? props.t('batch.dialog.renameQueue') : props.t('batch.dialog.newQueue');
  const hint = props.mode === 'rename'
    ? props.t('batch.dialog.renameHint')
    : props.t('batch.dialog.createHint');

  useEffect(() => {
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') props.onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [props.onClose]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    props.onSubmit(trimmed);
  }

  return (
    <div className="modalBackdrop organizerDialogBackdrop" onClick={props.onClose}>
      <section
        className="organizerDialog batchQueueNameDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-queue-name-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">Batch Queue</p>
            <h2 id="batch-queue-name-dialog-title">{title}</h2>
          </div>
          <button className="iconMiniButton" type="button" data-tooltip={props.t('common.close')} aria-label={props.t('common.close')} onClick={props.onClose}>
            <X size={15} />
          </button>
        </header>
        <label>
          <span>{props.t('batch.dialog.queueName')}</span>
          <input
            ref={inputRef}
            value={name}
            maxLength={32}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <p>{hint}</p>
        <div className="organizerDialogActions">
          <button type="button" className="confirmCancelButton" onClick={props.onClose}>{props.t('common.cancel')}</button>
          <button type="button" className="confirmPrimaryButton" disabled={!name.trim()} onClick={submit}>
            {props.mode === 'rename' ? props.t('common.save') : props.t('common.create')}
          </button>
        </div>
      </section>
    </div>
  );
}

export function ConfirmDialog(props: {
  t: Translator;
  request: ConfirmDialogState;
  onClose: () => void;
  onError: (error: string) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const confirmLabel = props.request.confirmLabel ?? props.t('common.confirm');
  const cancelLabel = props.request.cancelLabel ?? props.t('common.cancel');
  const tone = props.request.tone ?? 'default';

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) props.onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isSubmitting, props.onClose]);

  async function handleConfirm() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    props.onError('');
    try {
      await props.request.onConfirm();
      props.onClose();
    } catch (error) {
      props.onError(error instanceof Error ? error.message : String(error));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modalBackdrop confirmBackdrop" onClick={() => !isSubmitting && props.onClose()}>
      <section className={`confirmDialog ${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message" onClick={(event) => event.stopPropagation()}>
        <div className="confirmIconWrap">
          <Trash2 size={22} />
        </div>
        <div className="confirmContent">
          <p className="eyebrow">Confirm Action</p>
          <h2 id="confirm-dialog-title">{props.request.title}</h2>
          <p id="confirm-dialog-message">{props.request.message}</p>
          {props.request.error ? <small className="confirmError">{props.request.error}</small> : null}
        </div>
        <div className="confirmActions">
          <button type="button" className="confirmCancelButton" disabled={isSubmitting} onClick={props.onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={`confirmPrimaryButton ${tone}`} disabled={isSubmitting} onClick={() => void handleConfirm()}>
            {isSubmitting ? props.t('common.processing') : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function UtilityModalShell(props: {
  t?: Translator;
  title: string;
  eyebrow?: string;
  className?: string;
  onClose: () => void;
  children: ReactNode
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') props.onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [props.onClose]);

  return (
    <div className="modalBackdrop utilityModalBackdrop" onClick={props.onClose}>
      <section className={`utilityModal ${props.className ?? ''}`} role="dialog" aria-modal="true" aria-label={props.title} onClick={(event) => event.stopPropagation()}>
        <header className="utilityModalHeader">
          <div>
            {props.eyebrow ? <p className="eyebrow">{props.eyebrow}</p> : null}
            <h2>{props.title}</h2>
          </div>
          <button type="button" data-tooltip={props.t ? props.t('common.close') : 'Close'} aria-label={props.t ? props.t('common.close') : 'Close'} onClick={props.onClose}>
            <X size={18} />
          </button>
        </header>
        {props.children}
      </section>
    </div>
  );
}

export function ShortcutsModal(props: { t: Translator; onClose: () => void }) {
  return (
    <UtilityModalShell t={props.t} title={props.t('shortcut.title')} eyebrow="Keyboard Shortcuts" onClose={props.onClose}>
      <div className="shortcutModalContent">
        {shortcutGroups.map((group) => (
          <section className="shortcutGroup" key={group.titleKey}>
            <h3>{props.t(group.titleKey)}</h3>
            <div className="shortcutList">
              {group.items.map((item) => (
                <div className="shortcutRow" key={`${group.titleKey}-${item.actionKey}`}>
                  <div className="shortcutKeys">
                    {item.keys.map((key) => <kbd key={key}>{key}</kbd>)}
                  </div>
                  <span>{props.t(item.actionKey)}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </UtilityModalShell>
  );
}

export function SystemInfoModal(props: {
  t: Translator;
  appVersion: string;
  desktopRuntime: boolean;
  storageSettings: StorageSettings | null;
  settingsMessage: string;
  onClose: () => void;
}) {
  const rows = [
    { label: props.t('systemInfo.version'), value: props.appVersion },
    { label: props.t('systemInfo.runtime'), value: props.desktopRuntime ? props.t('systemInfo.runtimeDesktop') : props.t('systemInfo.runtimeWeb') },
    { label: props.t('systemInfo.libraryDir'), value: props.storageSettings?.resolved_library_dir ?? (props.desktopRuntime ? props.t('common.loading') : props.t('systemInfo.desktopOnly')) },
    { label: props.t('systemInfo.defaultLibraryDir'), value: props.storageSettings?.default_library_dir ?? '—' },
    { label: props.t('systemInfo.recentAction'), value: props.settingsMessage || props.t('systemInfo.noRecentAction') }
  ];

  return (
    <UtilityModalShell t={props.t} title={props.t('systemInfo.title')} eyebrow="System" onClose={props.onClose}>
      <div className="systemInfoList">
        {rows.map((row) => (
          <div className="systemInfoRow" key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </UtilityModalShell>
  );
}
