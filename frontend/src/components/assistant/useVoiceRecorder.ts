import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_RECORD_SECONDS, toWav } from './chatFiles';

export type RecorderState = 'idle' | 'recording' | 'processing';

/** Record from the microphone and return a WAV file. Stops by itself after the time limit. */
export function useVoiceRecorder(onError: (message: string) => void, onRecorded: (file: File) => void) {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const meter = useRef<{ ctx: AudioContext; frame: number } | null>(null);
  const cancelled = useRef(false);

  const cleanup = useCallback(() => {
    window.clearInterval(timer.current);
    if (meter.current) {
      cancelAnimationFrame(meter.current.frame);
      void meter.current.ctx.close();
      meter.current = null;
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recorder.current = null;
    setLevel(0);
  }, []);

  useEffect(() => () => {
    cancelled.current = true;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    cleanup();
  }, [cleanup]);

  /** Finish recording; the file arrives through onRecorded. */
  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    else cleanup();
    setState('idle');
  }, [cleanup]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError('Trình duyệt này chưa hỗ trợ ghi âm. Anh/chị thử Chrome, Edge hoặc Safari mới nhé.');
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = media;
      chunks.current = [];
      cancelled.current = false;
      const rec = new MediaRecorder(media);
      recorder.current = rec;
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        const type = rec.mimeType || 'audio/webm';
        cleanup();
        if (cancelled.current) return;
        setState('processing');
        try {
          const wav = await toWav(new Blob(chunks.current, { type }));
          const stamp = new Date().toTimeString().slice(0, 5).replace(':', 'h');
          onRecorded(new File([wav], `ghi-am-${stamp}.wav`, { type: 'audio/wav' }));
        } catch {
          onError('Không xử lý được đoạn ghi âm, anh/chị thử lại nhé.');
        } finally {
          setState('idle');
        }
      };
      rec.start(250);
      setSeconds(0);
      setState('recording');
      const startedAt = Date.now();
      timer.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(s);
        // Time limit reached: stop and hand over what was recorded.
        if (s >= MAX_RECORD_SECONDS && rec.state === 'recording') rec.stop();
      }, 250);

      // Simple input level for the recording indicator.
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(Math.min(1, peak / 64));
        if (meter.current) meter.current.frame = requestAnimationFrame(tick);
      };
      meter.current = { ctx, frame: requestAnimationFrame(tick) };
    } catch (e: any) {
      cleanup();
      setState('idle');
      onError(
        e?.name === 'NotAllowedError'
          ? 'Anh/chị chưa cho phép dùng micro. Bấm biểu tượng ổ khóa cạnh địa chỉ trang để bật micro nhé.'
          : e?.name === 'NotFoundError'
            ? 'Không tìm thấy micro trên thiết bị này.'
            : 'Không bật được micro.',
      );
    }
  }, [cleanup, onError, onRecorded]);

  return { state, seconds, level, start, stop, cancel };
}
