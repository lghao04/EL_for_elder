export async function convertWebMToWav(blob: Blob): Promise<Blob> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    
    // Tạo AudioContext với sample rate phù hợp với Vosk
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ 
      sampleRate: 16000 
    });

    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      // Lấy channel đầu tiên (mono)
      const channelData = audioBuffer.getChannelData(0);

      // Tạo WAV file
      const wavBuffer = encodeWAV(channelData, 16000);
      
      return new Blob([wavBuffer], { type: "audio/wav" });
    } finally {
      // Đóng AudioContext để giải phóng bộ nhớ
      await audioCtx.close();
    }
  } catch (error) {
    console.error("Error converting WebM to WAV:", error);
    throw new Error(`Failed to convert audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1; // Mono
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  let offset = 0;

  // RIFF chunk descriptor
  writeString(offset, "RIFF"); offset += 4;
  view.setUint32(offset, 36 + dataSize, true); offset += 4; // File size - 8
  writeString(offset, "WAVE"); offset += 4;

  // fmt sub-chunk
  writeString(offset, "fmt "); offset += 4;
  view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size (16 for PCM)
  view.setUint16(offset, 1, true); offset += 2;  // AudioFormat (1 = PCM)
  view.setUint16(offset, numChannels, true); offset += 2; // NumChannels
  view.setUint32(offset, sampleRate, true); offset += 4;  // SampleRate
  view.setUint32(offset, byteRate, true); offset += 4;    // ByteRate
  view.setUint16(offset, blockAlign, true); offset += 2;  // BlockAlign
  view.setUint16(offset, bitsPerSample, true); offset += 2; // BitsPerSample

  // data sub-chunk
  writeString(offset, "data"); offset += 4;
  view.setUint32(offset, dataSize, true); offset += 4;

  // Write audio samples
  let idx = 44;
  for (let i = 0; i < samples.length; i++, idx += 2) {
    // Clamp giá trị trong khoảng [-1, 1] và chuyển sang 16-bit PCM
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(idx, val, true);
  }

  return buffer;
}