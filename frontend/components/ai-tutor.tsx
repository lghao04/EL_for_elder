"use client"

import { useState, useRef, useEffect } from "react"
import { convertWebMToWav } from "../utils/convertspeech"

interface AITutorProps {
  language: string
}

export default function AITutor({ language }: AITutorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [showTranscript, setShowTranscript] = useState(false)
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false) // new: audio playback state

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null) // ref for audio playback

  // --- Recording functions ---
  const startRecording = async () => {
    // if audio is playing, stop it before recording
    if (audioRef.current && !audioRef.current.paused) {
      try {
        audioRef.current.pause()
      } catch (e) {}
      setIsPlaying(false)
    }

    // hide previous transcript & send button while recording
    setShowTranscript(false)

    if (!navigator.mediaDevices?.getUserMedia) {
      alert(language === "en"
        ? "Browser doesn't support recording"
        : "Browser không hỗ trợ ghi âm")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'

      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data?.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mr.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType })

        try {
          setLoading(true)

          // Convert to WAV
          const wavBlob = await convertWebMToWav(audioBlob)

          // Send to STT backend
          const form = new FormData()
          form.append("audio", wavBlob, "audio.wav")
          form.append("language", language)

          const res = await fetch("http://127.0.0.1:8000/api/speech-to-text", {
            method: "POST",
            body: form
          })

          if (!res.ok) {
            const errorText = await res.text().catch(() => "Unknown error")
            throw new Error(`Server error ${res.status}: ${errorText}`)
          }

          const data = await res.json()

          // update transcript and only show it after recording stopped and STT finished
          setTranscript(data.text || "")
          setShowTranscript(Boolean(data.text))

          if (!data.text) {
            alert(language === "en"
              ? "No speech detected. Please try again."
              : "Không phát hiện giọng nói. Vui lòng thử lại.")
          }

        } catch (err) {
          console.error("STT error:", err)
          alert(`${language === "en" ? "Error" : "Lỗi"}: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`)
        } finally {
          setLoading(false)
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
          }
        }
      }

      mr.onerror = (event: Event) => {
        console.error("MediaRecorder error:", event)
        alert(language === "en" ? "Recording error" : "Lỗi ghi âm")
        setRecording(false)
      }

      mr.start()
      setRecording(true)

    } catch (err) {
      console.error("Start recording failed:", err)
      alert(language === "en"
        ? "Cannot access microphone. Please check permissions."
        : "Không thể truy cập microphone. Vui lòng kiểm tra quyền.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }

  // --- Playback helper: play audio URL and manage UI state ---
  const playAudioUrl = async (audioUrl: string) => {
    // stop previous audio if any
    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch (e) {}
      audioRef.current = null
      setIsPlaying(false)
    }

    const audio = new Audio(audioUrl)
    audio.crossOrigin = "anonymous"
    audioRef.current = audio

    // listeners
    const onPlay = () => setIsPlaying(true)
    const onEnd = () => {
      setIsPlaying(false)
      // cleanup listeners
      audio.removeEventListener("playing", onPlay)
      audio.removeEventListener("ended", onEnd)
      audio.removeEventListener("error", onError)
    }
    const onError = (ev: any) => {
      console.error("Audio playback error:", ev)
      setIsPlaying(false)
      audio.removeEventListener("playing", onPlay)
      audio.removeEventListener("ended", onEnd)
      audio.removeEventListener("error", onError)
    }

    audio.addEventListener("playing", onPlay)
    audio.addEventListener("ended", onEnd)
    audio.addEventListener("error", onError)

    try {
      await audio.play()
      // isPlaying will be set by 'playing' event; but ensure state if event not fired
      setIsPlaying(true)
    } catch (err) {
      console.error("play() failed:", err)
      setIsPlaying(false)
    }
  }

  const stopAudioIfPlaying = () => {
    if (audioRef.current && !audioRef.current.paused) {
      try {
        audioRef.current.pause()
      } catch (e) {}
      setIsPlaying(false)
    }
  }

  // --- handle send message: request LLM, then TTS, use playAudioUrl ---
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const handleSendMessage = async () => {
    const messageToSend = transcript.trim();
    if (!messageToSend) {
      alert(language === "en" ? "Please enter a message" : "Vui lòng nhập tin nhắn");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/voice-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend, language })
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Server returned ${res.status}: ${txt}`);
      }

      const data = await res.json();

      if (data.audioUrl) {
        const audioUrl = data.audioUrl.startsWith("http")
          ? data.audioUrl
          : `${API_BASE}${data.audioUrl.startsWith('/') ? '' : '/'}${data.audioUrl}`;

        // play audio and animate mic -> speaker
        await playAudioUrl(audioUrl);
      }

      // Reset transcript editor only after sending (we hide it earlier when recording)
      setTranscript("");
      setShowTranscript(false);

    } catch (err) {
      console.error("Voice chat error:", err);
      alert(`${language === "en" ? "Error" : "Lỗi"}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Cleanup audio and recorder on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop()
      }
      if (audioRef.current) {
        try { audioRef.current.pause() } catch (e) {}
        audioRef.current = null
      }
    }
  }, [])

  // UI rendering
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full p-8 text-6xl hover:shadow-2xl transition transform hover:scale-110 shadow-xl z-40"
      >
        🐰
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-white rounded-4xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[600px] flex flex-col border-4 border-purple-300 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-400 to-pink-400 px-6 py-4 sm:p-6 flex justify-between items-center gap-4">
          <h2 className="text-2xl sm:text-4xl font-bold text-white flex items-center gap-2 sm:gap-4">
            🐰 {language === "en" ? "AI Tutor" : "Trợ lý AI"}
          </h2>
          <button
            onClick={() => {
              setIsOpen(false)
              setShowTranscript(false)
              setTranscript("")
              if (recording) stopRecording()
              stopAudioIfPlaying()
            }}
            className="bg-white text-purple-600 rounded-full p-2 sm:p-4 text-2xl sm:text-3xl hover:bg-opacity-90 transition font-bold flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-blue-50 to-white">

          <p className="text-2xl sm:text-4xl font-bold text-gray-800 text-center">
            {language === "en" ? "How can I help you?" : "Tôi có thể giúp gì cho bạn?"}
          </p>

          {/* Recording / Play Button */}
          <button
            onClick={() => {
              // If currently playing audio, pressing button will stop audio and revert
              if (isPlaying) {
                stopAudioIfPlaying()
                return
              }

              if (recording) {
                stopRecording()
              } else {
                startRecording()
              }
            }}
            disabled={loading}
            className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full text-6xl sm:text-8xl flex items-center justify-center transition-all transform 
              ${loading ? "bg-gray-400 cursor-not-allowed" : recording ? "bg-red-500 text-white shadow-2xl scale-110 animate-pulse" : "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl hover:shadow-2xl hover:scale-110 active:scale-95"}
              ${isPlaying ? "bg-yellow-400 text-white shadow-2xl" : ""} 
              ${isPlaying ? "animate-[pulse_1s_ease-in-out_infinite] scale-125" : ""}`}
          >
            {/* Icon logic:
                - recording -> stop icon
                - playing -> speaker icon
                - idle -> microphone icon
            */}
            {recording ? "⏹️" : isPlaying ? "🔊" : "🎤"}
          </button>

          {/* Status Text */}
          <p className="text-lg text-gray-600 font-medium">
            {recording
              ? (language === "en" ? "🔴 Recording... Tap to stop" : "🔴 Đang ghi... Nhấn để dừng")
              : isPlaying
                ? (language === "en" ? "🔊 Playing audio..." : "🔊 Đang phát âm thanh...")
                : loading
                  ? (language === "en" ? "⏳ Processing..." : "⏳ Đang xử lý...")
                  : (language === "en" ? "Tap to start recording" : "Nhấn để bắt đầu ghi âm")
            }
          </p>

          {/* Transcript Editor (hidden while recording) */}
          {showTranscript && (
            <div className="w-full space-y-4 animate-in fade-in duration-300">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={
                  language === "en"
                    ? "Your message will appear here..."
                    : "Tin nhắn của bạn sẽ xuất hiện ở đây..."
                }
                className="w-full rounded-2xl px-4 py-3 sm:px-6 sm:py-4 border-3 border-purple-300 text-lg sm:text-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 resize-none"
                rows={4}
                autoFocus
              />

              {/* Action Buttons: only visible when transcript is shown */}
              <div className="flex gap-3">
                <button
                  onClick={handleSendMessage}
                  disabled={loading || !transcript.trim()}
                  className={`flex-1 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-2xl py-3 sm:py-4 px-4 text-xl sm:text-2xl font-bold transition-all transform ${
                    loading || !transcript.trim()
                      ? "opacity-60 cursor-not-allowed"
                      : "hover:from-green-500 hover:to-green-600 hover:scale-105 active:scale-95"
                  }`}
                >
                  {loading ? "⏳" : `✓ ${language === "en" ? "Send" : "Gửi"}`}
                </button>

                <button
                  onClick={() => {
                    setTranscript("")
                    setShowTranscript(false)
                  }}
                  disabled={loading}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-2xl font-bold transition disabled:opacity-60"
                >
                  🗑️
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
