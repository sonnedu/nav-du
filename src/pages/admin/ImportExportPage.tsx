import { useState, useMemo } from 'react';
import { useI18n } from '../../lib/useI18n';
import type { NavConfig } from '../../lib/navTypes';
import { isNavConfig } from '../../lib/navValidate';
import { parseNavConfigFromYaml, dumpNavConfigToYaml, sortCategories } from '../../lib/navLoad';
import { ensureGroupOrder } from '../../lib/admin/navConfigOps';
import { AdminDialog } from './AdminDialog';

interface ImportExportPageProps {
  config: NavConfig;
  onSave: (next: NavConfig) => Promise<boolean | void>;
}

export function ImportExportPage({
  config,
  onSave
}: ImportExportPageProps) {
  const { m } = useI18n();
  const [importText, setImportText] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('export');
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'alert' | 'confirm';
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showAlert = (title: string, message: string) => 
    setDialog({ isOpen: true, title, message, type: 'alert' });

  const exportJson = useMemo(() => JSON.stringify(config, null, 2), [config]);
  const exportYaml = useMemo(() => dumpNavConfigToYaml(config), [config]);

  const handleImport = async () => {
    setError('');
    const text = importText.trim();
    if (!text) return;

    try {
      let parsed: unknown;
      if (text.startsWith('{')) {
        parsed = JSON.parse(text);
      } else {
        parsed = parseNavConfigFromYaml(text);
      }

      if (!isNavConfig(parsed)) {
        throw new Error('Invalid configuration format');
      }

      const normalized = ensureGroupOrder(sortCategories(parsed));
      const ok = await onSave(normalized);
      if (ok !== false) {
        setImportText('');
        showAlert(m.admin.import, m.admin.saveSuccess);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportText(content);
      setActiveTab('import');
    };
    reader.readAsText(file);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-page-content">
      <AdminDialog 
        {...dialog} 
        onClose={() => setDialog(prev => ({ ...prev, isOpen: false }))} 
      />
      <header className="admin-header">
        <h1 className="admin-title">{m.admin.import} / {m.admin.export}</h1>
      </header>

      <div className="admin-category-section p-0">
        <div className="admin-tabs flex-row">
          <button 
            className={`admin-nav-item admin-tab-btn ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            {m.admin.export}
          </button>
          <button 
            className={`admin-nav-item admin-tab-btn ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            {m.admin.import}
          </button>
        </div>

        <div className="p-1-5">
          {activeTab === 'export' ? (
            <div className="flex-col-gap-15">
              <div>
                <div className="flex-between-center mb-05">
                  <label className="admin-form-label">JSON</label>
                  <div className="flex-gap-05">
                    <button className="btn btn-sm" onClick={() => navigator.clipboard.writeText(exportJson)}>{m.admin.copy}</button>
                    <button className="btn btn-sm" onClick={() => downloadFile(exportJson, 'nav.json')}>{m.admin.exportJson}</button>
                  </div>
                </div>
                <textarea 
                  className="admin-input admin-textarea-mono admin-textarea-auto" 
                  value={exportJson} 
                  readOnly 
                />
              </div>
              <div>
                <div className="flex-between-center mb-05">
                  <label className="admin-form-label">YAML</label>
                  <div className="flex-gap-05">
                    <button className="btn btn-sm" onClick={() => navigator.clipboard.writeText(exportYaml)}>{m.admin.copy}</button>
                    <button className="btn btn-sm" onClick={() => downloadFile(exportYaml, 'nav.yaml')}>{m.admin.exportYaml}</button>
                  </div>
                </div>
                <textarea 
                  className="admin-input admin-textarea-mono admin-textarea-auto" 
                  value={exportYaml} 
                  readOnly 
                />
              </div>
            </div>
          ) : (
            <div className="flex-col-gap-15">
              <div>
                <label className="admin-form-label">{m.admin.importFile}</label>
                <input type="file" accept=".json,.yaml,.yml" onChange={handleFileUpload} />
              </div>
              <div>
                <label className="admin-form-label">{m.admin.pasteJsonYaml}</label>
                <textarea 
                  className="admin-input admin-textarea-mono admin-textarea-auto" 
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder="Paste JSON or YAML here..."
                  style={{ minHeight: '300px' }}
                />
              </div>
               {error && <div className="admin-error-text">{error}</div>}
            </div>
          )}
        </div>
      </div>

      {activeTab === 'import' && (
        <footer className="admin-footer-bar">
          <button className="btn btn-primary btn-min-120" onClick={handleImport} disabled={!importText.trim()}>
            {m.admin.apply}
          </button>
        </footer>
      )}
    </div>
  );
}
