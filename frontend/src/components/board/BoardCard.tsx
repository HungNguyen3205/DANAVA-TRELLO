import type React from 'react';
import { Briefcase, FolderInput, Shield, Star, UserCheck, Users } from 'lucide-react';
import { getAvatarUrl } from '../../lib/avatar';

/**
 * A board as a card: the board's photo/colour covers the whole card, with role, quick actions,
 * the board name and one line with its project and members. Used on "Tất cả bảng", project pages and Home.
 */
export function BoardCard({
  board,
  onClick,
  onToggleStar,
  onMove,
  hideProject = false,
}: {
  board: any,
  /** Board admins can move the board to another project. */
  onMove?: () => void,
  /** Inside a project page the project line would repeat on every card. */
  hideProject?: boolean,
  onClick?: () => void,
  onToggleStar?: (e: React.MouseEvent) => void
}) {
  const bgClass = board.color || 'bg-gradient-to-br from-blue-600 to-cyan-500';
  const isOwner = board.my_role === 'admin';
  const viaProject = !!board.via_project;
  const role = viaProject ? 'Quản lý dự án' : isOwner ? 'Chủ bảng' : 'Thành viên';

  return (
    <div
      onClick={onClick}
      title={board.name}
      className={`group relative h-full min-h-[11rem] flex flex-col justify-between rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 ${board.background_image ? 'bg-slate-800' : bgClass}`}
      style={board.background_image ? { backgroundImage: `url("${getAvatarUrl(board.background_image)}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      {/* Full-card cover. Dark at the top and bottom only, so the photo stays visible and the text stays readable. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/30 group-hover:via-black/15 transition-colors pointer-events-none" />

      {/* Top: role + quick actions */}
      <div className="relative z-10 flex items-start justify-between gap-2 p-3">
        <span className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-bold whitespace-nowrap shadow-sm ${
          isOwner ? 'bg-amber-400 text-amber-950' : 'bg-white/20 text-white backdrop-blur-sm'
        }`}>
          {isOwner ? <Shield size={11} /> : <UserCheck size={11} />}
          {role}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {onMove && (
            <button
              type="button"
              className="w-7 h-7 grid place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/60 transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onMove();
              }}
              title="Chuyển sang dự án khác"
              aria-label={`Chuyển bảng ${board.name} sang dự án khác`}
            >
              <FolderInput size={14} />
            </button>
          )}
          <button
            type="button"
            className={`w-7 h-7 grid place-items-center rounded-full bg-black/35 backdrop-blur-sm hover:bg-black/60 transition ${board.is_starred ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100'}`}
            onClick={onToggleStar}
            title={board.is_starred ? 'Bỏ gắn sao' : 'Gắn sao bảng này'}
            aria-label={board.is_starred ? 'Bỏ gắn sao' : 'Gắn sao bảng này'}
            aria-pressed={!!board.is_starred}
          >
            <Star size={14} className={board.is_starred ? 'text-yellow-300 fill-yellow-300' : 'text-white'} />
          </button>
        </div>
      </div>

      {/* Bottom: name, then one quiet line with project and members */}
      <div className="relative z-10 p-3.5 pt-6 space-y-1.5">
        <h4 className="text-[15px] font-bold text-white leading-snug line-clamp-2 break-words [text-shadow:0_1px_3px_rgb(0_0_0/0.45)]">
          {board.name}
        </h4>
        <div className="flex items-center gap-2 text-xs text-white/85 min-w-0">
          {board.project && !hideProject && (
            <>
              <span className="inline-flex items-center gap-1 min-w-0" title={`Dự án: ${board.project.name}`}>
                <Briefcase size={12} className="shrink-0" />
                <span className="truncate">{board.project.name}</span>
              </span>
              <span className="text-white/50 shrink-0" aria-hidden="true">·</span>
            </>
          )}
          <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
            <Users size={12} /> {board.members_count || 1}
          </span>
        </div>
      </div>
    </div>
  );
}
