'use client';

import { Card } from '@/components/ui/card';
import VoiceButton from '@/src/components/VoiceButton';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Card className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Coop Verboh Simulator</h1>
        <VoiceButton />
      </Card>
    </main>
  );
}
