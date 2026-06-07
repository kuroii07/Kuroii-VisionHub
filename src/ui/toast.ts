import { useEffect, type Dispatch, type SetStateAction } from 'react';

export type ToastLevel = 'info' | 'success' | 'warning' | 'error';

export type ToastEventDetail = {
  message: string;
  level?: ToastLevel;
  durationMs?: number;
};

export const appToastEventName = 'visionhub:toast';
export const defaultToastDurationMs = 3000;

export function inferToastLevel(message: string): ToastLevel {
  const lower = message.toLowerCase();
  if (
    lower.includes('error') ||
    lower.includes('failed') ||
    message.includes('失败') ||
    message.includes('错误') ||
    message.includes('未成功')
  ) {
    return 'error';
  }
  if (message.includes('超时') || message.includes('待核查') || message.includes('需要') || message.includes('请')) {
    return 'warning';
  }
  if (
    lower.includes('copied') ||
    message.includes('已') ||
    message.includes('成功') ||
    message.includes('保存') ||
    message.includes('复制')
  ) {
    return 'success';
  }
  return 'info';
}

export function pushToast(message: string, options: Omit<ToastEventDetail, 'message'> = {}) {
  if (!message.trim() || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ToastEventDetail>(appToastEventName, {
      detail: {
        message,
        level: options.level ?? inferToastLevel(message),
        durationMs: options.durationMs ?? defaultToastDurationMs
      }
    })
  );
}

export function useToastMessage(
  message: string,
  setMessage: Dispatch<SetStateAction<string>>,
  options: Omit<ToastEventDetail, 'message'> = {}
) {
  useEffect(() => {
    if (!message) return;
    pushToast(message, options);
    setMessage('');
  }, [message, options.durationMs, options.level, setMessage]);
}
