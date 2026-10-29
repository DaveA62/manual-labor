import { useState } from "react";
import type { ShiftReport as Report } from "../cloud/protocol";
import { Button, DialogPanel, Pager } from "../ui/Controls";
import { money } from "../ui/format";
export function ShiftReport({
  report,
  onCollect,
}: {
  report: Report | null;
  onCollect: () => void;
}) {
  const [requested, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil((report?.machines.length ?? 0) / 2)),
    page = Math.min(requested, pages - 1);
  const minutes = Math.floor((report?.elapsedMs ?? 0) / 60000);
  return (
    <DialogPanel
      open={!!report && report.total > 0}
      onClose={onCollect}
      title="Shift Report"
      code={
        report?.local
          ? "DEVICE RECORD / LOCAL ONLY"
          : "PRODUCTION RECORD / VERIFIED"
      }
      className="shift-dialog"
    >
      <dl className="shift-summary">
        <div>
          <dt>TIME AWAY</dt>
          <dd>
            {Math.floor(minutes / 60)}H {minutes % 60}M
          </dd>
        </div>
        <div>
          <dt>MACHINES OPERATED</dt>
          <dd>{report?.machines.length ?? 0}</dd>
        </div>
        <div>
          <dt>TOTAL PRODUCED</dt>
          <dd>{money(report?.total ?? 0)}</dd>
        </div>
      </dl>
      <div className="shift-machines">
        {report?.machines.slice(page * 2, page * 2 + 2).map((machine) => (
          <div key={machine.id}>
            <span>{machine.name}</span>
            <strong>{money(machine.earnings)}</strong>
          </div>
        ))}
      </div>
      <footer className="shift-actions">
        {pages > 1 && <Pager page={page} pages={pages} onChange={setPage} />}
        <Button tone="primary" onClick={onCollect}>
          Collect
        </Button>
      </footer>
    </DialogPanel>
  );
}
