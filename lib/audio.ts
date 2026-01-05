import { API_BASE_URL } from './api';

export function playAudio(buffer: ArrayBuffer) {
  const blob = new Blob([buffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
}

export async function playWelcomePrompt(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/voice/welcome`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch welcome audio');
  }

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);

  return new Promise((resolve) => {
    const audio = new Audio(audioUrl);
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };
    audio.play();
  });
}
