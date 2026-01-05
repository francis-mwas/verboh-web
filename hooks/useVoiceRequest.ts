import { useMutation } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/api';

export function useVoiceRequest() {
  return useMutation({
    mutationFn: async (audio: Blob) => {
      const formData = new FormData();
      formData.append('file', audio);

      const response = await fetch(`${API_BASE_URL}/api/v1/voice/process`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Voice processing failed');
      }

      return response.arrayBuffer();
    },
  });
}
