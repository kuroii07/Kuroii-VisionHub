export type ConfirmDialogRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  icon?: 'delete' | 'import';
  eyebrow?: string;
  multiline?: boolean;
  onConfirm: () => Promise<void> | void;
};
