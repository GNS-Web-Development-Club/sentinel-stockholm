import { useEffect, useRef, useState, useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import { buildRecordFromCsv } from '../engine/importCsv';
import type { ParsedCsv } from '../engine/csvParse';
import CsvWorker from '../engine/csvParser.worker.ts?worker';
import type { WorkerRequest, WorkerResponse } from '../engine/csvParser.worker';
import type { Action } from '../state';
import { useToasts } from './toastContext';
import { clientToLngLat } from './mapRef';

interface Props {
  dispatch: React.Dispatch<Action>;
}

export function ImportDropZone({ dispatch }: Props) {
  const [hover, setHover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragDepth = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const { push: pushToast } = useToasts();

  // Lazy-instantiate the worker on first import; tear it down on unmount.
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const parseInWorker = useCallback((req: WorkerRequest): Promise<ParsedCsv> => {
    if (!workerRef.current) workerRef.current = new CsvWorker();
    const worker = workerRef.current;
    return new Promise((resolve, reject) => {
      const onMessage = (ev: MessageEvent<WorkerResponse>) => {
        worker.removeEventListener('message', onMessage);
        if (ev.data.ok && ev.data.parsed) resolve(ev.data.parsed);
        else reject(new Error(ev.data.error ?? 'CSV parse failed.'));
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage(req);
    });
  }, []);

  const handleFile = useCallback(
    async (file: File, point?: { lat: number; lon: number }) => {
      try {
        const text = await file.text();
        // Default to a point in middle CONUS for drops outside the chart.
        const lat = point?.lat ?? 39.5;
        const lon = point?.lon ?? -98;
        const parsed = await parseInWorker({ text, opts: { lat, lon, name: file.name.replace(/\.csv$/i, '') } });
        const rec = buildRecordFromCsv(parsed);
        dispatch({ type: 'SELECT_SITE', record: rec });
        setError(null);
        pushToast('success', `Imported ${parsed.rows} rows from ${file.name}`, 2400);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        pushToast('error', `Import failed: ${msg}`);
      }
    },
    [dispatch, parseInWorker, pushToast],
  );

  return (
    <div
      className="drop-layer"
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        if (e.dataTransfer?.types?.includes('Files')) setHover(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setHover(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setHover(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
          const point = clientToLngLat(e.clientX, e.clientY);
          void handleFile(file, point ?? undefined);
        }
      }}
      style={{ zIndex: hover ? 1000 : -1, pointerEvents: hover ? 'auto' : 'none' }}
    >
      {hover && (
        <div className="drop-scrim">
          <div className="drop-card">
            <UploadCloud size={36} strokeWidth={1.5} color="var(--blue)" />
            <div className="t">Drop a sensor CSV</div>
            <div className="d">
              Columns: timestamp, DO, pH, turbidity, conductivity, temperature, ORP. Missing columns are
              inferred from the regional baseline.
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="drop-error" style={{ pointerEvents: 'auto' }}>
          <strong>Import failed.</strong> {error}{' '}
          <button className="btn-link" onClick={() => setError(null)} style={{ marginLeft: 8 }}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
