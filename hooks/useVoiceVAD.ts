'use client';

import { useState, useRef } from 'react';
import { useVoiceRequest } from '@/hooks/useVoiceRequest';
import { playAudio } from '@/lib/audio';

export function useVoiceVAD() {
  const [recording, setRecording] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);

  const voiceMutation = useVoiceRequest();

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setRecording(true);

    // Setup audio context + analyser for amplitude-based VAD
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    dataArrayRef.current = dataArray;

    // Setup MediaRecorder to capture actual audio
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };

    mediaRecorder.start();

    monitorVolume();
  };

  const stopRecording = async (): Promise<Blob | null> => {
    if (!mediaRecorderRef.current) return null;

    return new Promise((resolve) => {
      mediaRecorderRef.current!.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/wav',
        });
        setRecording(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        audioContextRef.current?.close();
        resolve(audioBlob);
      };
      mediaRecorderRef.current!.stop();
    });
  };

  // Amplitude-based VAD
  const monitorVolume = () => {
    if (!recording || !analyserRef.current || !dataArrayRef.current) return;

    // Make a proper Uint8Array copy to satisfy TS
    const tempArray = new Uint8Array(dataArrayRef.current);

    analyserRef.current.getByteFrequencyData(tempArray);
    const avg =
      Array.from(tempArray).reduce((a, b) => a + b, 0) / tempArray.length;
    const threshold = 5;

    if (avg < threshold) {
      stopRecording()
        .then(async (blob) => {
          if (blob) {
            const responseBuffer = await voiceMutation.mutateAsync(blob);
            playAudio(responseBuffer);
          }
        })
        .catch(console.error);
      return;
    }

    rafRef.current = requestAnimationFrame(monitorVolume);
  };

  return { startRecording, recording };
}
