"use client"

import { useState, useRef, useEffect } from "react"

interface Message {
  id: string
  type: "user" | "ai"
  text: string
  timestamp: Date
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      text: "Hello! Let's practice speaking together!",
      timestamp: new Date(),
    },
  ])
  const [language] = useState("en") // hoặc "vi"
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const API_BASE = "http://127.0.0.1:8000"

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Convert WebM/MP4 to WAV
  const convertWebMToWav = async (blob: Blob): Promise<Blob> => {
    const arrayBuffer = await blob.arrayBuffer()
    const audioContext = new AudioContext({ sampleRate: 16000 })
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    
    const wavBuffer = audioBufferToWav(audioBuffer)
    return new Blob([wavBuffer], { type: 'audio/wav' })
  }

  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44
    const result = new ArrayBuffer(length)
    const view = new DataView(result)
    const channels: Float32Array[] = []
    let offset = 0
    let pos = 0

    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true)
      pos += 2
    }

    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true)
      pos += 4
    }

    // RIFF identifier
    setUint32(0x46464952)
    // file length minus RIFF identifier length and file description length
    setUint32(length - 8)
    // RIFF type
    setUint32(0x45564157)
    // format chunk identifier
    setUint32(0x20746d66)
    // format chunk length
    setUint32(16)
    // sample format (raw)
    setUint16(1)
    // channel count
    setUint16(buffer.numberOfChannels)
    // sample rate
    setUint32(buffer.sampleRate)
    // byte rate (sample rate * block align)
    setUint32(buffer.sampleRate * buffer.numberOfChannels * 2)
    // block align (channel count * bytes per sample)
    setUint16(buffer.numberOfChannels * 2)
    // bits per sample
    setUint16(16)
    // data chunk identifier
    setUint32(0x61746164)
    // data chunk length
    setUint32(length - pos - 4)

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i))
    }

    while (pos < length) {
      for (let i = 0; i < buffer.numberOfChannels; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]))
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
        view.setInt16(pos, sample, true)
        pos += 2
      }
      offset++
    }

    return result
  }

  const startRecording = async () => {
    if (audioRef.current && !audioRef.current.paused) {
      try {
        audioRef.current.pause()
      } catch (e) {}
      setIsPlaying(false)
    }

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

      // onstop does the sequential workflow: STT -> display script -> voice-chat -> display+play audio
      mr.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType })

        try {
          setLoading(true)

          // 1) Convert to WAV
          const wavBlob = await convertWebMToWav(audioBlob)

          // 2) Call STT API
          const form = new FormData()
          form.append("audio", wavBlob, "audio.wav")
          form.append("language", language)

          const res = await fetch(`${API_BASE}/api/speech-to-text`, {
            method: "POST",
            body: form
          })

          if (!res.ok) {
            const errorText = await res.text().catch(() => "Unknown error")
            throw new Error(`Server error ${res.status}: ${errorText}`)
          }

          const data = await res.json()

          if (!data.text) {
            alert(language === "en"
              ? "No speech detected. Please try again."
              : "Không phát hiện giọng nói. Vui lòng thử lại.")
            return
          }

          // 3) Immediately add script (user message) to chat history
          const userMessage: Message = {
            id: Date.now().toString(),
            type: "user",
            text: data.text,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, userMessage])

          // 4) Now call voice-chat API sequentially (after STT result is displayed)
          const vcRes = await fetch(`${API_BASE}/api/voice-chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: data.text,
              language,
              session_id: sessionId
            })
          })

          if (!vcRes.ok) {
            const txt = await vcRes.text().catch(() => "")
            throw new Error(`Voice chat error ${vcRes.status}: ${txt}`)
          }

          const vcData = await vcRes.json()

          // Update sessionId if backend returned one
          if (vcData.session_id) {
            setSessionId(vcData.session_id)
          }

          // 5) Add AI reply to history
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            text: vcData.text || (language === "en" ? "I received your message!" : "Tôi đã nhận tin nhắn của bạn!"),
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, aiMessage])

          // 6) Play audio if provided
          if (vcData.audioUrl) {
            const audioUrl = vcData.audioUrl.startsWith("http")
              ? vcData.audioUrl
              : `${API_BASE}${vcData.audioUrl.startsWith('/') ? '' : '/'}${vcData.audioUrl}`

            await playAudioUrl(audioUrl)
          }

        } catch (err) {
          console.error("STT/Voice Chat error:", err)
          alert(`${language === "en" ? "Error" : "Lỗi"}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        } finally {
          setLoading(false)
          // stop tracks and cleanup stream
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

  const playAudioUrl = async (audioUrl: string) => {
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

    const onPlay = () => setIsPlaying(true)
    const onEnd = () => {
      setIsPlaying(false)
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
      setIsPlaying(true)
    } catch (err) {
      console.error("play() failed:", err)
      setIsPlaying(false)
    }
  }

  const handleMicClick = () => {
    if (recording) {
      stopRecording()
    } else {
      // disable starting new recording if currently processing
      if (loading) return
      startRecording()
    }
  }

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

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-100 via-yellow-100 to-pink-100">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-xs lg:max-w-md px-6 py-4 rounded-3xl text-lg font-semibold shadow-lg ${
                message.type === "user"
                  ? "bg-gradient-to-r from-green-400 to-emerald-400 text-white"
                  : "bg-white text-gray-800 border-4 border-blue-300"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Recording Section */}
      <div className="bg-white border-t-4 border-blue-300 p-4 flex flex-col items-center gap-3">
        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" />
            <p className="text-lg font-bold text-blue-500">Processing...</p>
          </div>
        )}

        {/* Mic Button */}
        <button
          onClick={handleMicClick}
          disabled={loading}
          className={`rounded-full p-6 text-4xl transition-all transform ${
            recording
              ? "bg-red-500 hover:bg-red-600 scale-110 animate-pulse shadow-2xl"
              : isPlaying
              ? "bg-blue-400 hover:bg-blue-500 shadow-2xl"
              : loading
              ? "bg-gray-400 cursor-not-allowed shadow-2xl"
              : "bg-green-400 hover:bg-green-500 hover:scale-105 shadow-2xl"
          }`}
        >
          {recording ? "⏹️" : isPlaying ? "🔊" : "🎤"}
        </button>

        {/* Recording Indicator */}
        {recording && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <p className="text-lg font-bold text-red-500">Listening...</p>
          </div>
        )}

        {/* Playing Indicator */}
        {isPlaying && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            <p className="text-lg font-bold text-blue-500">Playing...</p>
          </div>
        )}
      </div>
    </div>
  )
}
