import { ChevronLeft, ChevronRight, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent, type WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Translator } from '../i18n';

export type ImagePreviewNavigationItem = {
  id: string;
  imageUrl: string;
  label: string;
};

export type ImagePreviewNavigation = {
  items: ImagePreviewNavigationItem[];
  currentId: string;
};

export type ImagePreviewState = {
  imageUrl: string;
  navigation?: ImagePreviewNavigation;
};

export const ImagePreviewModal = memo(function ImagePreviewModal(props: {
  t: Translator;
  imageUrl: string;
  navigation?: ImagePreviewNavigation;
  onNavigate?: (item: ImagePreviewNavigationItem) => void;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const pointerDownPoint = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const navigationItems = props.navigation?.items ?? [];
  const navigationIndex = props.navigation
    ? navigationItems.findIndex((item) => item.id === props.navigation?.currentId)
    : -1;
  const hasPreviewNavigation = Boolean(props.onNavigate && navigationItems.length > 1 && navigationIndex >= 0);
  const canNavigatePrevious = hasPreviewNavigation && navigationIndex > 0;
  const canNavigateNext = hasPreviewNavigation && navigationIndex < navigationItems.length - 1;

  const applyImageTransform = useCallback((nextOffset: { x: number; y: number }, nextScale: number) => {
    if (!imageRef.current) return;
    imageRef.current.style.setProperty('--preview-offset-x', `${nextOffset.x}px`);
    imageRef.current.style.setProperty('--preview-offset-y', `${nextOffset.y}px`);
    imageRef.current.style.setProperty('--preview-scale', String(nextScale));
  }, []);

  useEffect(() => {
    setScale(1);
    offsetRef.current = { x: 0, y: 0 };
    scaleRef.current = 1;
    setIsDragging(false);
    didDrag.current = false;
    window.requestAnimationFrame(() => applyImageTransform({ x: 0, y: 0 }, 1));
    window.setTimeout(() => modalRef.current?.focus(), 0);
  }, [applyImageTransform, props.imageUrl]);

  function clampScale(value: number) {
    return Math.min(6, Math.max(0.25, value));
  }

  function zoomBy(delta: number) {
    setScale((current) => {
      const nextScale = clampScale(Number((current + delta).toFixed(2)));
      scaleRef.current = nextScale;
      applyImageTransform(offsetRef.current, nextScale);
      return nextScale;
    });
  }

  function resetView() {
    setScale(1);
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setIsDragging(false);
    didDrag.current = false;
    applyImageTransform({ x: 0, y: 0 }, 1);
  }

  function navigatePreview(delta: -1 | 1) {
    if (!hasPreviewNavigation) return;
    const target = navigationItems[navigationIndex + delta];
    if (!target) return;
    props.onNavigate?.(target);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.nativeEvent.cancelable) {
      event.nativeEvent.preventDefault();
    }
    zoomBy(event.deltaY > 0 ? -0.12 : 0.12);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDownPoint.current = { x: event.clientX, y: event.clientY };
    didDrag.current = false;
    setIsDragging(true);
    setDragStart({
      x: event.clientX - offsetRef.current.x,
      y: event.clientY - offsetRef.current.y
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    const moveX = event.clientX - pointerDownPoint.current.x;
    const moveY = event.clientY - pointerDownPoint.current.y;
    if (Math.hypot(moveX, moveY) > 4) didDrag.current = true;
    const nextOffset = {
      x: event.clientX - dragStart.x,
      y: event.clientY - dragStart.y
    };
    offsetRef.current = nextOffset;
    applyImageTransform(nextOffset, scaleRef.current);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  }

  function handleViewportClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    if (event.target === event.currentTarget) props.onClose();
  }

  function handlePreviewKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      props.onClose();
      return;
    }
    if (event.key === 'ArrowLeft' && hasPreviewNavigation) {
      event.preventDefault();
      navigatePreview(-1);
      return;
    }
    if (event.key === 'ArrowRight' && hasPreviewNavigation) {
      event.preventDefault();
      navigatePreview(1);
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(0.2);
      return;
    }
    if (event.key === '-') {
      event.preventDefault();
      zoomBy(-0.2);
      return;
    }
    if (event.key === '0' || event.key === ' ') {
      event.preventDefault();
      resetView();
    }
  }

  const previewContent = (
    <div ref={modalRef} className="modalBackdrop previewModalBackdrop" onClick={props.onClose} onKeyDown={handlePreviewKeyDown} tabIndex={-1}>
      <div className="previewModal">
        <div className="previewToolbar" onClick={(event) => event.stopPropagation()}>
          <button type="button" data-tooltip={props.t('imagePreview.zoomOut')} aria-label={props.t('imagePreview.zoomOut')} onClick={() => zoomBy(-0.2)}>
            <ZoomOut size={16} />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button type="button" data-tooltip={props.t('imagePreview.zoomIn')} aria-label={props.t('imagePreview.zoomIn')} onClick={() => zoomBy(0.2)}>
            <ZoomIn size={16} />
          </button>
          <button type="button" data-tooltip={props.t('imagePreview.fit')} aria-label={props.t('imagePreview.fit')} onClick={resetView}>
            <Maximize2 size={16} />
          </button>
          <button type="button" data-tooltip={props.t('imagePreview.close')} aria-label={props.t('imagePreview.close')} onClick={props.onClose}>
            <X size={18} />
          </button>
        </div>
        {hasPreviewNavigation ? (
          <>
            <button
              className="previewNavButton previous"
              type="button"
              disabled={!canNavigatePrevious}
              data-tooltip={props.t('imagePreview.previous')}
              aria-label={props.t('imagePreview.previous')}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                navigatePreview(-1);
              }}
            >
              <ChevronLeft size={30} />
            </button>
            <button
              className="previewNavButton next"
              type="button"
              disabled={!canNavigateNext}
              data-tooltip={props.t('imagePreview.next')}
              aria-label={props.t('imagePreview.next')}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                navigatePreview(1);
              }}
            >
              <ChevronRight size={30} />
            </button>
            <div className="previewNavCounter" aria-label={props.t('imagePreview.counter')}>
              {navigationIndex + 1} / {navigationItems.length}
            </div>
          </>
        ) : null}
        <div
          className={`previewViewport ${isDragging ? 'isDragging' : ''}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={resetView}
          onClick={handleViewportClick}
        >
          <img
            ref={imageRef}
            src={props.imageUrl}
            alt={props.t('imagePreview.alt')}
            draggable={false}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? previewContent : createPortal(previewContent, document.body);
});
