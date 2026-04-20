import { supabase } from "@/integrations/supabase/client";

/**
 * Convert a Blob into a base64 string (without the `data:<mime>;base64,` prefix).
 * Useful for sending audio payloads to edge functions as JSON.
 */
export const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/**
 * Pick a MediaRecorder mimeType supported by the current browser.
 * Falls back to undefined (browser default) if neither preferred type is supported.
 */
export const pickRecorderMimeType = (): string | undefined => {
  if (typeof MediaRecorder === "undefined") return undefined;
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus";
  }
  if (MediaRecorder.isTypeSupported("audio/mp4")) {
    return "audio/mp4";
  }
  return undefined;
};

/**
 * Request microphone access with sensible defaults for voice recording.
 */
export const requestMicStream = (): Promise<MediaStream> =>
  navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

export interface TranscribeResult {
  text: string;
}

/**
 * Send recorded audio to the `transcribe-recording` edge function and
 * return the transcribed text.
 */
export async function transcribeRecording(audioBlob: Blob): Promise<TranscribeResult> {
  const base64 = await blobToBase64(audioBlob);
  const { data, error } = await supabase.functions.invoke("transcribe-recording", {
    body: { audio: base64, mimeType: audioBlob.type || "audio/webm" },
  });
  if (error) throw new Error(error.message || "Transcription failed");

  const text = (data?.text ?? "").toString().trim();
  if (!text) {
    throw new Error("We couldn't hear any words — try recording again.");
  }
  return { text };
}

export interface SynthesizeVoiceParams {
  text: string;
  voiceId?: string;
}

/**
 * Synthesize speech via the `synthesize-voice` edge function (ElevenLabs).
 * Returns a playable object URL for an <audio> element.
 *
 * NOTE: requires a `synthesize-voice` edge function that returns
 * `{ audio: <base64>, mimeType: <string> }`.
 */
export async function synthesizeVoice({
  text,
  voiceId,
}: SynthesizeVoiceParams): Promise<{ url: string; blob: Blob }> {
  const { data, error } = await supabase.functions.invoke("synthesize-voice", {
    body: { text, voiceId },
  });
  if (error) throw new Error(error.message || "Voice synthesis failed");

  const audioB64 = (data?.audio ?? "").toString();
  const mimeType = (data?.mimeType ?? "audio/mpeg").toString();
  if (!audioB64) throw new Error("No audio returned from voice synthesis.");

  const byteString = atob(audioB64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  return { url, blob };
}
