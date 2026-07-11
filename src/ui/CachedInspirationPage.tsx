import { memo } from 'react';
import type { InspirationAsset } from '../domain/inspirationTypes';
import type { ImagePromptReverseSettings } from '../services/appSettings';
import type { Translator } from '../i18n';
import type { ConfirmDialogRequest } from './confirmDialog';
import { InspirationPage } from './InspirationPage';
import {
  ImagePreviewModal,
  type ImagePreviewNavigation,
  type ImagePreviewNavigationItem,
  type ImagePreviewState
} from './ImagePreviewModal';

export const CachedInspirationPage = memo(function CachedInspirationPage(props: {
  t: Translator;
  isActive: boolean;
  preview: ImagePreviewState | null;
  onPreview: (imageUrl: string, navigation?: ImagePreviewNavigation) => void;
  onNavigatePreview: (item: ImagePreviewNavigationItem) => void;
  onClosePreview: () => void;
  onUseAsReference: (asset: InspirationAsset) => void;
  onUsePrompt: (prompt: string) => void;
  onCreateTemplate: (title: string, prompt: string, tags: string[]) => string;
  onRequestConfirm: (request: ConfirmDialogRequest) => void;
  imagePromptReverse: ImagePromptReverseSettings;
  imagePromptReverseSecretAvailable: boolean;
  onOpenSettings: () => void;
  importVersion: number;
}) {
  return (
    <section
      className={`workspacePage cachedInspirationPage ${props.isActive ? 'active' : 'inactive'}`}
      aria-hidden={!props.isActive}
    >
      <InspirationPage
        t={props.t}
        onPreview={props.onPreview}
        onUseAsReference={props.onUseAsReference}
        onUsePrompt={props.onUsePrompt}
        onCreateTemplate={props.onCreateTemplate}
        onRequestConfirm={props.onRequestConfirm}
        imagePromptReverse={props.imagePromptReverse}
        imagePromptReverseSecretAvailable={props.imagePromptReverseSecretAvailable}
        onOpenSettings={props.onOpenSettings}
        importVersion={props.importVersion}
      />
      {props.isActive && props.preview ? (
        <ImagePreviewModal
          t={props.t}
          imageUrl={props.preview.imageUrl}
          navigation={props.preview.navigation}
          onNavigate={props.onNavigatePreview}
          onClose={props.onClosePreview}
        />
      ) : null}
    </section>
  );
});
