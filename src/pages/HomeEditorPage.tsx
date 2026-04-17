import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ExternalLink, RefreshCw, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { defaultHomeContent } from '../data/platformDefaults.js';
import type { AdminCenterData, HomeContentSettings } from '../types.js';

interface AdminCenterResponse {
  data: AdminCenterData;
}

interface AdminCenterPatchResponse {
  homeContent?: HomeContentSettings;
}

type NodeValue = string | number | boolean | null | NodeObject | NodeValue[];
interface NodeObject {
  [key: string]: NodeValue;
}

function isObjectNode(value: NodeValue): value is NodeObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneHomeContent(input: HomeContentSettings): HomeContentSettings {
  return JSON.parse(JSON.stringify(input)) as HomeContentSettings;
}

function formatLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (value) => value.toUpperCase());
}

function updateByPath(base: HomeContentSettings, path: Array<string | number>, value: string): HomeContentSettings {
  const next = cloneHomeContent(base) as unknown as NodeValue;
  let cursor = next as NodeValue;

  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    if (Array.isArray(cursor)) {
      cursor = cursor[Number(segment)] as NodeValue;
      continue;
    }

    if (isObjectNode(cursor)) {
      cursor = cursor[String(segment)] as NodeValue;
      continue;
    }
  }

  const last = path[path.length - 1];
  if (Array.isArray(cursor)) {
    cursor[Number(last)] = value;
  } else if (isObjectNode(cursor)) {
    cursor[String(last)] = value;
  }

  return next as unknown as HomeContentSettings;
}

export function HomeEditorPage() {
  const [draft, setDraft] = useState<HomeContentSettings>(cloneHomeContent(defaultHomeContent));
  const [initial, setInitial] = useState<HomeContentSettings>(cloneHomeContent(defaultHomeContent));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/admin-center', {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          let message = 'No se pudo cargar la configuración del home.';
          try {
            const payload = await response.json() as { error?: string };
            message = payload.error ?? message;
          } catch {
            /* noop */
          }
          throw new Error(message);
        }

        const payload = await response.json() as AdminCenterResponse;
        const content = payload.data.homeContent ?? defaultHomeContent;

        if (!cancelled) {
          const cloned = cloneHomeContent(content);
          setDraft(cloned);
          setInitial(cloned);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Error cargando el editor del home.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasChanges = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial]);

  function renderNode(node: NodeValue, path: Array<string | number>, label: string): ReactElement {
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean' || node === null) {
      const currentValue = String(node ?? '');
      const isLongText = currentValue.length > 90 || /lead|description|title|message|text/i.test(label);

      return (
        <label key={path.join('.')} className="field-group" style={{ display: 'grid', gap: '8px' }}>
          <span className="field-label">{label}</span>
          {isLongText ? (
            <textarea
              value={currentValue}
              onChange={(event) => {
                setDraft((current) => updateByPath(current, path, event.target.value));
                setSuccessMessage(null);
              }}
              rows={4}
            />
          ) : (
            <input
              type="text"
              value={currentValue}
              onChange={(event) => {
                setDraft((current) => updateByPath(current, path, event.target.value));
                setSuccessMessage(null);
              }}
            />
          )}
        </label>
      );
    }

    if (Array.isArray(node)) {
      return (
        <section key={path.join('.')} className="surface section-card" style={{ display: 'grid', gap: '14px' }}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Lista</span>
              <h3>{label}</h3>
            </div>
          </div>
          {node.map((item, index) => renderNode(item, [...path, index], `${label} ${index + 1}`))}
        </section>
      );
    }

    if (isObjectNode(node)) {
      return (
        <section key={path.join('.')} className="surface section-card" style={{ display: 'grid', gap: '14px' }}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Bloque</span>
              <h3>{label}</h3>
            </div>
          </div>
          {Object.entries(node).map(([key, value]) => renderNode(value, [...path, key], formatLabel(key)))}
        </section>
      );
    }

    return <></>;
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/admin-center', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          section: 'home-content',
          data: draft,
        }),
      });

      if (!response.ok) {
        let message = 'No fue posible guardar los cambios del home.';
        try {
          const payload = await response.json() as { error?: string };
          message = payload.error ?? message;
        } catch {
          /* noop */
        }
        throw new Error(message);
      }

      const payload = await response.json() as AdminCenterPatchResponse;
      const saved = payload.homeContent ?? draft;
      const cloned = cloneHomeContent(saved);
      setDraft(cloned);
      setInitial(cloned);
      setSuccessMessage('Home actualizado correctamente. Los cambios ya están disponibles en el sitio público.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Error guardando el home.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="surface section-card section-card--compact" style={{ display: 'grid', gap: '16px' }}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Editor del Home</span>
            <h3>Edición frontal de textos del sitio público</h3>
          </div>
        </div>

        <p className="section-lead">
          Aquí puedes editar todos los bloques de texto del home. Guarda y los cambios se publican en tiempo real.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" className="cta-button" onClick={handleSave} disabled={isSaving || isLoading || !hasChanges}>
            <Save size={16} />
            <span>{isSaving ? 'Guardando...' : 'Guardar cambios'}</span>
          </button>

          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setDraft(cloneHomeContent(initial));
              setSuccessMessage(null);
            }}
            disabled={isSaving || isLoading || !hasChanges}
          >
            <RefreshCw size={16} />
            <span>Restablecer borrador</span>
          </button>

          <Link to="/" className="ghost-button" target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            <span>Abrir home público</span>
          </Link>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {successMessage ? <p className="form-success">{successMessage}</p> : null}
      </section>

      {isLoading ? (
        <section className="surface section-card">
          <p className="section-lead">Cargando configuración editable del home...</p>
        </section>
      ) : (
        Object.entries(draft).map(([key, value]) => renderNode(value as NodeValue, [key], formatLabel(key)))
      )}
    </div>
  );
}
