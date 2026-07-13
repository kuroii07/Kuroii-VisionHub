import type { Translator } from '../i18n';
import type { ProviderDiagnosticItem, ProviderDiagnosticLevel } from '../services/providerDiagnostics';

type ProviderPresentationTemplate = {
  id: string;
  region: 'domestic' | 'overseas' | 'local' | 'custom';
  status: 'connected' | 'configurable' | 'planned' | 'local-plan';
  apiDocUrl?: string;
  supportsTextToImage?: boolean;
  supportsImageToImage?: boolean;
  requiresPolling?: boolean;
};

type ProviderMatrixStatus = 'live' | 'configurable' | 'partial' | 'planned' | 'localPlan' | 'unsupported' | 'unknown';

type ProviderCapabilityMatrixColumn = {
  key: string;
  label: string;
};

type ProviderCapabilityMatrixRow = {
  template: ProviderPresentationTemplate;
  cells: Array<{ status: ProviderMatrixStatus }>;
};

function translate(t: Translator, key: string, params?: Record<string, string | number>) {
  return t(key as Parameters<Translator>[0], params);
}

function providerServiceTemplateLabel(template: ProviderPresentationTemplate, t: Translator) {
  return translate(t, `provider.service.${template.id}.label`);
}

function providerServiceTemplateDescription(template: ProviderPresentationTemplate, t: Translator) {
  return translate(t, `provider.service.${template.id}.description`);
}

function providerServiceStatusText(template: ProviderPresentationTemplate, t: Translator) {
  return translate(t, `provider.status.${template.status}`);
}

function providerServiceRegionText(template: ProviderPresentationTemplate, t: Translator) {
  return translate(t, `provider.region.${template.region}`);
}

function providerMatrixStatusText(status: ProviderMatrixStatus, t: Translator) {
  return translate(t, `provider.matrixStatus.${status}`);
}

function providerDiagnosticLevelLabel(level: ProviderDiagnosticLevel, t: Translator) {
  return translate(t, `provider.diagnosticLevel.${level}`);
}

export function ServiceTemplateMeta(props: {
  template: ProviderPresentationTemplate;
  t: Translator;
}) {
  const capabilityLabels = [
    props.template.supportsTextToImage ? translate(props.t, 'provider.capability.textToImage') : null,
    props.template.supportsImageToImage ? translate(props.t, 'provider.capability.imageToImage') : null,
    props.template.requiresPolling ? translate(props.t, 'provider.capability.asyncTask') : null
  ].filter(Boolean);

  return (
    <div className="serviceTemplateMeta" aria-label={translate(props.t, 'provider.meta.aria')}>
      <span className={`regionBadge ${props.template.region}`}>{providerServiceRegionText(props.template, props.t)}</span>
      <span className={`serviceStatusBadge ${props.template.status}`}>{providerServiceStatusText(props.template, props.t)}</span>
      {capabilityLabels.length
        ? <span>{capabilityLabels.join(' / ')}</span>
        : <span>{translate(props.t, 'provider.capability.unknown')}</span>}
      {props.template.apiDocUrl ? (
        <span className="serviceDocHint">{translate(props.t, 'provider.meta.docRegistered')}</span>
      ) : null}
    </div>
  );
}

export function ProviderReadinessPanel(props: {
  items: ProviderDiagnosticItem[];
  t: Translator;
}) {
  return (
    <section className="providerReadinessPanel" aria-label={translate(props.t, 'provider.readiness.aria')}>
      <div className="providerReadinessHeader">
        <strong>{translate(props.t, 'provider.readiness.title')}</strong>
        <small>{translate(props.t, 'provider.readiness.hint')}</small>
      </div>
      <div className="providerReadinessGrid">
        {props.items.map((item) => (
          <div className={`providerReadinessItem ${item.level}`} key={item.id}>
            <div>
              <div className="providerReadinessTitleRow">
                <strong>{item.label}</strong>
                <span>{providerDiagnosticLevelLabel(item.level, props.t)}</span>
              </div>
              <small>{item.detail}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProviderCapabilityMatrixPanel(props: {
  columns: ProviderCapabilityMatrixColumn[];
  rows: ProviderCapabilityMatrixRow[];
  selectedTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  t: Translator;
}) {
  const statusDetail = (
    template: ProviderPresentationTemplate,
    status: ProviderMatrixStatus,
    columnLabel: string
  ) => {
    if (status === 'unsupported') {
      return translate(props.t, 'provider.matrixDetail.unsupported', {
        service: providerServiceTemplateLabel(template, props.t),
        column: columnLabel
      });
    }
    return translate(props.t, `provider.matrixDetail.${status}`, { column: columnLabel });
  };

  return (
    <section className="providerCapabilityPanel expanded" aria-label={translate(props.t, 'provider.matrix.aria')}>
      <div className="providerCapabilityHeaderBlock">
        <div>
          <strong>{translate(props.t, 'provider.matrix.title')}</strong>
          <small>{translate(props.t, 'provider.matrix.hint')}</small>
        </div>
        <div className="providerCapabilityLegend" aria-label={translate(props.t, 'provider.matrix.legendAria')}>
          {(['live', 'configurable', 'partial', 'planned', 'localPlan'] as ProviderMatrixStatus[]).map((status) => (
            <span className={`capabilityCell ${status}`} key={status}>{providerMatrixStatusText(status, props.t)}</span>
          ))}
        </div>
      </div>
      <div className="providerCapabilityScroll">
        <div className="providerCapabilityGrid providerCapabilityTableHead" role="row">
          <span>{translate(props.t, 'provider.serviceTemplate')}</span>
          {props.columns.map((column) => (
            <span key={column.key}>{column.label}</span>
          ))}
        </div>
        <div className="providerCapabilityRows">
          {props.rows.map((row) => (
            <button
              type="button"
              className={`providerCapabilityGrid providerCapabilityRow ${row.template.id === props.selectedTemplateId ? 'selected' : ''}`}
              key={row.template.id}
              onClick={() => props.onSelectTemplate(row.template.id)}
              aria-pressed={row.template.id === props.selectedTemplateId}
            >
              <span className="providerCapabilityService">
                <strong>{providerServiceTemplateLabel(row.template, props.t)}</strong>
                <small>
                  {providerServiceRegionText(row.template, props.t)} · {providerServiceStatusText(row.template, props.t)} · {providerServiceTemplateDescription(row.template, props.t)}
                </small>
              </span>
              {row.cells.map((cell, index) => (
                <span
                  className={`capabilityCell ${cell.status}`}
                  title={translate(props.t, 'provider.matrix.cellTitle', {
                    column: props.columns[index].label,
                    status: providerMatrixStatusText(cell.status, props.t),
                    detail: statusDetail(row.template, cell.status, props.columns[index].label)
                  })}
                  key={props.columns[index].key}
                >
                  {providerMatrixStatusText(cell.status, props.t)}
                </span>
              ))}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProviderDiagnosticsResults(props: {
  diagnostics: ProviderDiagnosticItem[];
  t: Translator;
}) {
  if (props.diagnostics.length === 0) {
    return <p className="diagnosticsHint">{translate(props.t, 'provider.diagnostics.emptyHint')}</p>;
  }

  const summary = {
    pass: props.diagnostics.filter((item) => item.level === 'pass').length,
    warn: props.diagnostics.filter((item) => item.level === 'warn').length,
    fail: props.diagnostics.filter((item) => item.level === 'fail').length,
    info: props.diagnostics.filter((item) => item.level === 'info').length
  };

  return (
    <>
      <div className="diagnosticsSummary">
        <span className="pass">{translate(props.t, 'provider.summary.pass', { count: summary.pass })}</span>
        <span className="warn">{translate(props.t, 'provider.summary.warn', { count: summary.warn })}</span>
        <span className="fail">{translate(props.t, 'provider.summary.fail', { count: summary.fail })}</span>
        <span className="info">{translate(props.t, 'provider.summary.info', { count: summary.info })}</span>
      </div>
      <div className="diagnosticsList">
        {props.diagnostics.map((item) => (
          <div className={`diagnosticsItem ${item.level}`} key={item.id}>
            <span>{providerDiagnosticLevelLabel(item.level, props.t)}</span>
            <div>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
