import { PROJECT_STATUS_OPTIONS } from '../../lib/boardType';
import { getAvatarUrl } from '../../lib/avatar';
import type { PersonLite } from '../../lib/api/projects';

export function ProjectStatusBadge({ status }: { status: string }) {
  const o = PROJECT_STATUS_OPTIONS.find((x) => x.value === status);
  return (
    <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${o?.className ?? 'bg-muted text-muted-foreground'}`}>
      {o?.label ?? 'Chưa đặt'}
    </span>
  );
}

/** Thin progress bar with the percentage announced to screen readers. */
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Tiến độ'}>
      <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

export function AvatarStack({ people, max = 4, size = 26 }: { people: PersonLite[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex -space-x-1.5">
      {shown.map((p) => (
        <span key={p.id} title={p.name} className="rounded-full border-2 border-card bg-secondary text-secondary-foreground grid place-items-center overflow-hidden text-[10px] font-bold"
          style={{ width: size, height: size }}>
          {p.avatar ? <img src={getAvatarUrl(p.avatar)} alt={p.name} className="w-full h-full object-cover" /> : p.name.trim().split(/\s+/).pop()?.[0]?.toUpperCase()}
        </span>
      ))}
      {rest > 0 && (
        <span className="rounded-full border-2 border-card bg-muted text-muted-foreground grid place-items-center text-[10px] font-bold" style={{ width: size, height: size }}>
          +{rest}
        </span>
      )}
    </div>
  );
}
