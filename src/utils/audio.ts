/**
 * Web Audio and MediaRecorder utilities for RAYS
 */

// Synthesize pleasant minimal notification chime
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Smooth dual sine wave chime
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // D6

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  } catch (err) {
    console.debug('Audio chime skipped', err);
  }
}

// Synthesize subtle message sent sound
export function playMessageSentSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  } catch (err) {
    console.debug('Message sent sound skipped', err);
  }
}

export interface VoiceRecorderState {
  isRecording: boolean;
  duration: number;
  waveform: number[];
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private intervalId: number | null = null;
  private waveformData: number[] = [];
  private startTime: number = 0;

  async start(onUpdate?: (state: VoiceRecorderState) => void): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.waveformData = [];
      this.startTime = Date.now();

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);
      }

      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);

      // Periodically sample audio levels for waveform
      this.intervalId = window.setInterval(() => {
        let level = 30;
        if (this.analyser) {
          const buffer = new Uint8Array(this.analyser.frequencyBinCount);
          this.analyser.getByteFrequencyData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i];
          }
          const avg = sum / buffer.length;
          level = Math.min(100, Math.max(15, Math.round((avg / 255) * 100)));
        } else {
          level = 20 + Math.round(Math.random() * 60);
        }
        this.waveformData.push(level);
        if (this.waveformData.length > 50) {
          this.waveformData.shift();
        }

        if (onUpdate) {
          onUpdate({
            isRecording: true,
            duration: Math.floor((Date.now() - this.startTime) / 1000),
            waveform: [...this.waveformData],
          });
        }
      }, 100);

      return true;
    } catch (err) {
      console.error('Failed to start voice recorder', err);
      return false;
    }
  }

  async stop(): Promise<{ blob: Blob; base64: string; duration: number; waveform: number[] } | null> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (!this.mediaRecorder) return null;

    const duration = Math.max(1, Math.floor((Date.now() - this.startTime) / 1000));
    const capturedWaveform = this.waveformData.length > 0 ? [...this.waveformData] : generateFallbackWaveform(duration);

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve({
            blob: audioBlob,
            base64,
            duration,
            waveform: normalizeWaveform(capturedWaveform, 28),
          });
        };
        reader.readAsDataURL(audioBlob);

        this.cleanup();
      };

      this.mediaRecorder.stop();
    });
  }

  cancel() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  private cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

export function generateFallbackWaveform(durationSeconds: number = 3): number[] {
  const bars = 28;
  const result: number[] = [];
  for (let i = 0; i < bars; i++) {
    const sin = Math.sin((i / bars) * Math.PI);
    const noise = Math.random() * 0.4 + 0.2;
    result.push(Math.round((sin * 0.7 + noise * 0.3) * 100));
  }
  return result;
}

export function normalizeWaveform(raw: number[], targetBars: number = 28): number[] {
  if (!raw || raw.length === 0) return generateFallbackWaveform();
  if (raw.length === targetBars) return raw;

  const result: number[] = [];
  const step = raw.length / targetBars;
  for (let i = 0; i < targetBars; i++) {
    const idx = Math.min(raw.length - 1, Math.floor(i * step));
    result.push(Math.max(15, Math.min(100, raw[idx] || 35)));
  }
  return result;
}
