import { useEffect, useRef, useState } from 'react';
import { AssistantAvatar, type AvatarMood } from './AssistantAvatar';
import type { RobotScene } from './robot3dScene';
import { loadPrefs, useAssistantPrefs } from './assistantPrefs';

interface RobotAvatarProps {
  mood: AvatarMood;
  look?: { x: number; y: number };
  size?: number;
}

let webgl: boolean | null = null;
function hasWebGL(): boolean {
  if (webgl === null) {
    try {
      const c = document.createElement('canvas');
      webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

/**
 * 3D robot (three.js, loaded on demand). The SVG robot is shown while it loads and
 * replaces it permanently if WebGL is unavailable or the 3D scene fails.
 */
export function RobotAvatar({ mood, look = { x: 0, y: 0 }, size = 64 }: RobotAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<RobotScene | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(() => !hasWebGL());
  const prefs = useAssistantPrefs();

  useEffect(() => {
    if (failed) return;
    let cancelled = false;
    import('./robot3dScene')
      .then(({ RobotScene }) => {
        if (cancelled || !canvasRef.current) return;
        const saved = loadPrefs();
        sceneRef.current = new RobotScene(canvasRef.current, size, { eye: saved.eyeColor, ring: saved.ringColor });
        setReady(true);
      })
      .catch((e) => {
        console.warn('[assistant] 3D robot unavailable, using SVG', e);
        webgl = false;
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [size, failed]);

  useEffect(() => {
    sceneRef.current?.setColors({ eye: prefs.eyeColor, ring: prefs.ringColor });
  }, [prefs.eyeColor, prefs.ringColor, ready]);

  useEffect(() => {
    sceneRef.current?.setMood(mood);
  }, [mood, ready]);

  useEffect(() => {
    sceneRef.current?.setLook(look.x, look.y);
  }, [look.x, look.y, ready]);

  if (failed) return <AssistantAvatar mood={mood} look={look} size={size} eyeColor={prefs.eyeColor} ringColor={prefs.ringColor} />;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {!ready && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <AssistantAvatar mood={mood} look={look} size={size} eyeColor={prefs.eyeColor} ringColor={prefs.ringColor} />
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        aria-hidden="true"
        style={{ width: size, height: size, display: 'block', opacity: ready ? 1 : 0, transition: 'opacity .3s ease' }}
      />
    </div>
  );
}
