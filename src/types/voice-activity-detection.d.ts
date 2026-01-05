declare module 'voice-activity-detection' {
  export interface VADOptions {
    onVoiceStart?: () => void;
    onVoiceStop?: () => void;
    smoothing?: number;
    threshold?: number;
  }

  export interface VADInstance {
    start: () => void;
    stop: () => void;
  }

  function VAD(stream: MediaStream, options?: VADOptions): VADInstance;

  export default VAD;
}
