import { useId, type CSSProperties } from 'react';
import { shade } from './assistantPrefs';

export type AvatarMood = 'idle' | 'peek' | 'waving' | 'thinking' | 'talking' | 'celebrate' | 'nod' | 'wink' | 'lookaround' | 'surprised';

interface AssistantAvatarProps {
  mood: AvatarMood;
  /** Pointer direction (-1..1 on each axis): the glowing eyes follow it. */
  look?: { x: number; y: number };
  size?: number;
  className?: string;
  /** LED eye colour (#rrggbb). */
  eyeColor?: string;
  /** Disc colour behind the head (#rrggbb). */
  ringColor?: string;
}

/**
 * Original robot assistant: a glossy chat bubble with a blue ring, a round white
 * robot head, dark visor and glowing cyan eyes that follow the pointer.
 * Moods (shared CSS in assistant.css): floating, blinking, glow pulse, happy ^ ^ eyes,
 * wink, thinking dots, talking mouth, nod, glance around, celebration hop with sparkles.
 */
export function AssistantAvatar({ mood, look = { x: 0, y: 0 }, size = 132, className = '', eyeColor = '#22F2FF', ringColor = '#0B7BFF' }: AssistantAvatarProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const rim = `asst-rim-${uid}`;
  const ring = `asst-ring-${uid}`;
  const head = `asst-headfill-${uid}`;
  const visor = `asst-visor-${uid}`;
  const glow = `asst-glow-${uid}`;
  const shadow = `asst-shadow-${uid}`;
  const chrome = `asst-chrome-${uid}`;

  const style = {
    // Eyes move inside the visor; the head follows a little.
    '--look-x': `${look.x * 7}px`,
    '--look-y': `${look.y * 4.5}px`,
    '--head-x': `${look.x * 2.5}px`,
    '--head-y': `${look.y * 1.8}px`,
    width: size,
    height: size,
  } as CSSProperties;

  return (
    <svg viewBox="0 0 200 200" className={`asst-avatar asst-robot asst-mood-${mood} ${className}`} style={style} role="img" aria-hidden="true">
      <defs>
        <radialGradient id={rim} cx="35%" cy="22%" r="85%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#F1F5FC" />
          <stop offset="100%" stopColor="#C7D2E8" />
        </radialGradient>
        <radialGradient id={ring} cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor={shade(ringColor, 0.25)} />
          <stop offset="55%" stopColor={ringColor} />
          <stop offset="100%" stopColor={shade(ringColor, -0.3)} />
        </radialGradient>
        <radialGradient id={head} cx="40%" cy="26%" r="80%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#EEF2F8" />
          <stop offset="100%" stopColor="#BFC9DA" />
        </radialGradient>
        <linearGradient id={visor} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1E2A44" />
          <stop offset="100%" stopColor="#050A18" />
        </linearGradient>
        <linearGradient id={chrome} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="45%" stopColor="#94A3B8" />
          <stop offset="70%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>
        <filter id={glow} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={shadow} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#0A2A7A" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Glossy white chat bubble with a curved tail */}
      <g className="asst-r-bubble">
        <path d="M 52 158 Q 44 180 22 196 Q 58 194 88 174 Z" fill={`url(#${rim})`} stroke="#C7D2E8" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="100" cy="94" r="88" fill={`url(#${rim})`} stroke="#C7D2E8" strokeWidth="1.5" />
        <path d="M 30 70 A 76 76 0 0 1 104 14" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.95" />
        <circle cx="100" cy="94" r="74" fill={`url(#${ring})`} />
        <circle cx="100" cy="94" r="73" fill="none" stroke="#0A3FB0" strokeWidth="3" opacity="0.45" />
        <path d="M 138 34 A 66 66 0 0 1 160 58" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.55" />
        <circle className="asst-r-halo" cx="100" cy="98" r="62" fill="#22D3EE" opacity="0.3" filter={`url(#${glow})`} />
      </g>

      {/* Robot head (follows the pointer slightly) */}
      <g className="asst-head">
        <g className="asst-r-headpos">
          {/* Chrome ear pods with cyan lights */}
          <rect x="35" y="80" width="22" height="42" rx="11" fill={`url(#${chrome})`} filter={`url(#${shadow})`} />
          <rect x="143" y="80" width="22" height="42" rx="11" fill={`url(#${chrome})`} filter={`url(#${shadow})`} />
          <rect className="asst-r-earlight" x="37" y="89" width="4.5" height="24" rx="2.2" fill={eyeColor} filter={`url(#${glow})`} />
          <rect className="asst-r-earlight" x="158.5" y="89" width="4.5" height="24" rx="2.2" fill={eyeColor} filter={`url(#${glow})`} />

          <circle cx="100" cy="100" r="54" fill={`url(#${head})`} filter={`url(#${shadow})`} />
          <path d="M 66 70 A 44 44 0 0 1 116 54" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.95" />

          {/* Wide visor with a chrome frame */}
          <rect x="53" y="74" width="94" height="52" rx="26" fill={`url(#${visor})`} stroke={`url(#${chrome})`} strokeWidth="4" />
          <path d="M 118 82 Q 132 82 138 94" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.3" />

          {/* Eyes: open glowing dots, or happy ^ ^ arcs */}
          <g className="asst-pupil">
            <g transform="translate(82 100)">
              <g className="asst-eye asst-eye-l">
                <circle className="asst-r-eye-open" r="11" fill={eyeColor} filter={`url(#${glow})`} />
                <circle className="asst-r-eye-open" cx="-3" cy="-3.5" r="2.6" fill="#ECFEFF" opacity="0.9" />
                <path className="asst-r-eye-happy" d="M -10 4 Q 0 -10 10 4" stroke={eyeColor} strokeWidth="5" strokeLinecap="round" fill="none" filter={`url(#${glow})`} />
              </g>
            </g>
            <g transform="translate(118 100)">
              <g className="asst-eye asst-eye-r">
                <circle className="asst-r-eye-open" r="11" fill={eyeColor} filter={`url(#${glow})`} />
                <circle className="asst-r-eye-open" cx="-3" cy="-3.5" r="2.6" fill="#ECFEFF" opacity="0.9" />
                <path className="asst-r-eye-happy" d="M -10 4 Q 0 -10 10 4" stroke={eyeColor} strokeWidth="5" strokeLinecap="round" fill="none" filter={`url(#${glow})`} />
              </g>
            </g>
          </g>

          {/* Mouth: small dot, animated when talking */}
          <g transform="translate(100 141)">
            <circle className="asst-r-mouth" r="3.4" fill="#111827" />
          </g>
        </g>

        {/* Thinking bubble */}
        <g className="asst-think">
          <circle cx="150" cy="40" r="3.5" fill="#FFFFFF" stroke="#BFDBFE" />
          <circle cx="160" cy="28" r="5" fill="#FFFFFF" stroke="#BFDBFE" />
          <rect x="158" y="2" width="40" height="20" rx="10" fill="#FFFFFF" stroke="#BFDBFE" />
          <circle className="asst-dot" cx="169" cy="12" r="2.6" fill="#2563EB" />
          <circle className="asst-dot" cx="178" cy="12" r="2.6" fill="#2563EB" />
          <circle className="asst-dot" cx="187" cy="12" r="2.6" fill="#22D3EE" />
        </g>
      </g>

      {/* Sparkles for celebrations */}
      <g className="asst-sparkles">
        <path className="asst-spark" d="M18 40 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z" fill="#22D3EE" />
        <path className="asst-spark" d="M186 70 l2.4 6 l6 2.4 l-6 2.4 l-2.4 6 l-2.4 -6 l-6 -2.4 l6 -2.4 z" fill="#3B82F6" />
        <path className="asst-spark" d="M12 120 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill="#3B82F6" />
        <path className="asst-spark" d="M184 140 l2.6 6.5 l6.5 2.6 l-6.5 2.6 l-2.6 6.5 l-2.6 -6.5 l-6.5 -2.6 l6.5 -2.6 z" fill="#22D3EE" />
        <circle className="asst-spark" cx="40" cy="12" r="3" fill="#FFC94D" />
        <circle className="asst-spark" cx="168" cy="186" r="2.5" fill="#FFC94D" />
      </g>
    </svg>
  );
}
