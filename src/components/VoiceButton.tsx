'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useVoiceRequest } from '@/hooks/useVoiceRequest';
import { playAudio } from '@/lib/audio';
import { API_BASE_URL } from '@/lib/api';

export default function VoiceButton() {
  const [recording, setRecording] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const voiceMutation = useVoiceRequest();

  // Start recording
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    analyserRef.current = analyser;
    dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

    // Setup MediaRecorder
    const mediaRecorder = new MediaRecorder(stream);
    recordedChunksRef.current = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data);
    };
    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;

    setRecording(true);
    monitorVolume();
  };

  // Stop recording and return Blob
  const stopRecording = async (): Promise<Blob | null> => {
    if (!mediaRecorderRef.current) return null;

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

  // Amplitude-based VAD
  const monitorVolume = () => {
    if (!recording || !analyserRef.current || !dataArrayRef.current) return;

    // Allocate a fresh Uint8Array for TS & avoid SharedArrayBuffer issues
    const arr = new Uint8Array(dataArrayRef.current.length);
    analyserRef.current.getByteFrequencyData(arr);

    const avg = Array.from(arr).reduce((a, b) => a + b, 0) / arr.length;

    const threshold = 5;
    if (avg < threshold) {
      stopRecording()
        .then(async (blob) => {
          if (blob) {
            const responseBuffer = await voiceMutation.mutateAsync(blob);
            await playAudio(responseBuffer);
          }
        })
        .catch(console.error);

      setRecording(false);
      return;
    }

    rafRef.current = requestAnimationFrame(monitorVolume);
  };

  // Play welcome + start recording
  const handleClick = async () => {
    if (!recording) {
      try {
        // 1️⃣ Play welcome audio
        const welcomeResponse = await fetch(
          `${API_BASE_URL}/api/v1/voice/welcome`
        );
        const welcomeArrayBuffer = await welcomeResponse.arrayBuffer();
        await playAudio(welcomeArrayBuffer);

        // 2️⃣ Start recording after welcome
        await startRecording();
      } catch (err) {
        console.error('Voice interaction error:', err);
      }
    } else {
      // Stop manually
      const blob = await stopRecording();
      if (blob) {
        const responseBuffer = await voiceMutation.mutateAsync(blob);
        await playAudio(responseBuffer);
      }
      setRecording(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center">
      <Card className="p-6 space-y-4 text-center">
        <h1 className="text-xl font-semibold">Coop Verboh Simulator</h1>
        <Button
          onClick={handleClick}
          disabled={voiceMutation.isPending}
          className="bg-green-600 hover:bg-green-700 text-white w-24 h-24 rounded-full flex items-center justify-center text-2xl shadow-lg"
        >
          {recording ? '🎤' : '🎙️'}
        </Button>
      </Card>
    </main>
  );
}
