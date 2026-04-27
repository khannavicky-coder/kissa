import { supabase } from "@/integrations/supabase/client";

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
 * Send recorded audio to the `transcribe-recording` edge function as
 * multipart/form-data (required by Whisper via OpenAI API).
 */
export async function transcribeRecording(audioBlob: Blob): Promise<TranscribeResult> {
  // Derive a sensible filename from the MIME type
  const ext = audioBlob.type.includes("mp4")
    ? "mp4"
    : audioBlob.type.includes("mpeg")
    ? "mp3"
    : "webm";
  const file = new File([audioBlob], `recording.${ext}`, { type: audioBlob.type || "audio/webm" });

  const formData = new FormData();
  formData.append("audio", file);

  const { data, error } = await supabase.functions.invoke("transcribe-recording", {
    body: formData,
  });

  if (error) throw new Error(error.message || "Transcription failed");

  // Edge function returns { transcript } (not { text })
  const text = (data?.transcript ?? data?.text ?? "").toString().trim();
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
 * Returns a playable public URL for an <audio> element.
 */
export async function synthesizeVoice({
  text,
  voiceId,
}: SynthesizeVoiceParams): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke("synthesize-voice", {
    body: { storyText: text, voiceId },
  });

  if (error) throw new Error(error.message || "Voice synthesis failed");

  const audioUrl = (data?.audioUrl ?? "").toString();
  if (!audioUrl) throw new Error("No audio URL returned from voice synthesis.");

  return { url: audioUrl };
}

