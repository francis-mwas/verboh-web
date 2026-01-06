'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useVoiceRequest } from '@/hooks/useVoiceRequest';
import { playAudio } from '@/lib/audio';
import { API_BASE_URL } from '@/lib/api';

export default function VoiceButton() {
  const [recording, setRecording] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const dataArrayRef = useRef<Uint8Array | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);

  const hasPlayedWelcomeRef = useRef(false);
  const autoStoppedRef = useRef(false);

  const voiceMutation = useVoiceRequest();

  // ------------------ START RECORDING ------------------
  const startRecording = async () => {
    autoStoppedRef.current = false;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    source.connect(analyser);
    analyserRef.current = analyser;

    dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

    const mediaRecorder = new MediaRecorder(stream);
    recordedChunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();

    setRecording(true);

    // Ensure recorder is actually running before monitoring
    await new Promise((resolve) => {
      mediaRecorder.onstart = () => resolve(true);
    });

    monitorVolume();
  };

  // ------------------ STOP RECORDING ------------------
  const stopRecording = (): Promise<Blob | null> => {
    if (!mediaRecorderRef.current) return Promise.resolve(null);

    return new Promise((resolve) => {
      mediaRecorderRef.current!.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: 'audio/webm',
        });
        resolve(blob);
      };

      mediaRecorderRef.current!.stop();
    });
  };

  // ------------------ AUTO VAD ------------------
  const monitorVolume = () => {
    if (
      !recording ||
      !analyserRef.current ||
      !dataArrayRef.current ||
      autoStoppedRef.current
    ) {
      return;
    }

    const arr = new Uint8Array(dataArrayRef.current.length);
    analyserRef.current.getByteFrequencyData(arr);

    const avg = arr.reduce((sum, v) => sum + v, 0) / arr.length;

    const SILENCE_THRESHOLD = 5;

    if (avg < SILENCE_THRESHOLD) {
      autoStoppedRef.current = true;
      setRecording(false);

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      stopRecording()
        .then(async (blob) => {
          if (blob && blob.size > 0) {
            const responseBuffer = await voiceMutation.mutateAsync(blob);
            await playAudio(responseBuffer);
          }
        })
        .catch(console.error);

      return;
    }

    rafRef.current = requestAnimationFrame(monitorVolume);
  };

  // ------------------ BUTTON HANDLER ------------------
  const handleClick = async () => {
    try {
      if (!recording) {
        // Welcome plays once per page session
        if (!hasPlayedWelcomeRef.current) {
          hasPlayedWelcomeRef.current = true;

          const res = await fetch(`${API_BASE_URL}/api/v1/voice/welcome`);
          const buf = await res.arrayBuffer();
          await playAudio(buf);
        }

        await startRecording();
      } else {
        // Manual stop fallback
        setRecording(false);

        const blob = await stopRecording();
        if (blob && blob.size > 0) {
          const responseBuffer = await voiceMutation.mutateAsync(blob);
          await playAudio(responseBuffer);
        }
      }
    } catch (err) {
      console.error('Voice error:', err);
    }
  };

  // ------------------ UI ------------------
  return (
    <main className="flex items-center justify-center">
      <Button
        onClick={handleClick}
        disabled={voiceMutation.isPending}
        className="bg-green-600 hover:bg-green-700 text-white w-24 h-24 rounded-full flex items-center justify-center text-2xl shadow-lg transition-colors"
      >
        {recording ? '🎤' : '🎙️'}
      </Button>
    </main>
  );
}
