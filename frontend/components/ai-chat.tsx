"use client"

import { useState, useRef, useEffect, useCallback } from "react"

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
  const [language] = useState("en")
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const WS_URL = process.env.NEXT_PUBLIC_WS_URL // e.g. ws://localhost:8000
  const userId = useRef(`user_${Date.now()}`)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // ─── Play audio from base64 ───────────────────────────────────────────────
  const playAudioBase64 = async (base64Data: string, mimeType: string = "audio/mpeg") => {
    if (audioRef.current) {
      try { audioRef.current.pause() } catch (e) {}
      audioRef.current = null
      setIsPlaying(false)
    }

    const byteChars = atob(base64Data)
    const byteArray = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i)
    }
    const blob = new Blob([byteArray], { type: mimeType })
    const audioUrl = URL.createObjectURL(blob)

    const audio = new Audio(audioUrl)
    audioRef.current = audio

    const cleanup = () => {
      setIsPlaying(false)
      URL.revokeObjectURL(audioUrl)
      audio.removeEventListener("playing", onPlay)
      audio.removeEventListener("ended", cleanup)
      audio.removeEventListener("error", onError)
    }
    const onPlay = () => setIsPlaying(true)
    const onError = (ev: any) => {
      console.error("Audio playback error:", ev)
      cleanup()
    }

    audio.addEventListener("playing", onPlay)
    audio.addEventListener("ended", cleanup)
    audio.addEventListener("error", onError)

    try {
      await audio.play()
      setIsPlaying(true)
    } catch (err) {
      console.error("play() failed:", err)
      setIsPlaying(false)
    }
  }

  // ─── WebSocket setup ──────────────────────────────────────────────────────
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${WS_URL}/ws/chat/${userId.current}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log("✅ WebSocket connected")
      setWsConnected(true)
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    ws.onclose = () => {
      console.log("WebSocket disconnected, reconnecting in 3s...")
      setWsConnected(false)
      reconnectTimerRef.current = setTimeout(connectWebSocket, 3000)
    }

    ws.onerror = (err) => {
      console.error("WebSocket error:", err)
    }

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data)

        switch (msg.type) {
          case "connected":
            console.log("WS confirmed connected:", msg.connection_id)
            break

          case "transcript_complete":
            // User message (từ audio STT)
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                type: "user",
                text: msg.text,
                timestamp: new Date(),
              },
            ])
            break

          case "message":
            // AI reply text
            if (msg.role === "assistant") {
              setMessages((prev) => [
                ...prev,
                {
                  id: (Date.now() + 1).toString(),
                  type: "ai",
                  text: msg.content,
                  timestamp: new Date(),
                },
              ])
            }
            break

          case "audio_data":
            // Phát audio từ base64
            setLoading(false)
            await playAudioBase64(msg.data, msg.mime_type || "audio/mpeg")
            break

          case "error":
            console.error("WS error from server:", msg.message)
            alert(`${language === "en" ? "Error" : "Lỗi"}: ${msg.message}`)
            setLoading(false)
            break

          // các type khác (transcribing, llm_response_start, audio_progress...) bỏ qua
          default:
            break
        }
      } catch (err) {
        console.error("Failed to parse WS message:", err)
      }
    }
  }, [WS_URL, language])

  useEffect(() => {
    connectWebSocket()
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [connectWebSocket])

  // ─── Recording ────────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!wsConnected) {
      alert(language === "en" ? "Not connected. Please wait..." : "Chưa kết nối. Vui lòng đợi...")
      return
    }

    if (audioRef.current && !audioRef.current.paused) {
      try { audioRef.current.pause() } catch (e) {}
      setIsPlaying(false)
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      alert(language === "en" ? "Browser doesn't support recording" : "Browser không hỗ trợ ghi âm")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = async () => {
        try {
          setLoading(true)

          const audioBlob = new Blob(chunksRef.current, { type: mimeType })

          // Thông báo bắt đầu gửi audio
          wsRef.current?.send(JSON.stringify({
            type: "audio_start",
            format: mimeType.includes("webm") ? "webm" : "mp4",
            language,
          }))

          // Gửi audio dưới dạng base64 chunk
          const arrayBuffer = await audioBlob.arrayBuffer()
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
          wsRef.current?.send(JSON.stringify({
            type: "audio_chunk",
            data: base64,
          }))

          // Thông báo kết thúc
          wsRef.current?.send(JSON.stringify({
            type: "audio_end",
            language,
          }))

        } catch (err) {
          console.error("Send audio error:", err)
          alert(`${language === "en" ? "Error" : "Lỗi"}: ${err instanceof Error ? err.message : "Unknown error"}`)
          setLoading(false)
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
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
      alert(language === "en" ? "Cannot access microphone. Please check permissions." : "Không thể truy cập microphone. Vui lòng kiểm tra quyền.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }

  const handleMicClick = () => {
    if (recording) {
      stopRecording()
    } else {
      if (loading) return
      startRecording()
    }
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
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
    <div className="flex flex-col h-screen bg-gradient-to-br from-pink-100 via-orange-100 to-rose-100">
    {/* Connection status */}
    <div className={`text-center text-sm py-1 font-semibold ${
      wsConnected 
        ? "bg-pink-100 text-pink-600" 
        : "bg-orange-100 text-orange-600"
    }`}>
      {wsConnected ? "🟢 Connected" : "🟡 Connecting..."}
    </div>

    {/* Chat Messages */}
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-xs lg:max-w-md px-6 py-4 rounded-3xl text-lg font-semibold shadow-lg ${
              message.type === "user"
                ? "bg-gradient-to-r from-pink-400 to-orange-400 text-white"
                : "bg-white text-gray-800 border-4 border-pink-300"
            }`}
          >
            {message.text}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>

    {/* Recording Section */}
    <div className="bg-white border-t-4 border-pink-300 p-4 flex flex-col items-center gap-3">
      {loading && (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-400 rounded-full animate-bounce" />
          <p className="text-lg font-bold text-orange-500">Processing...</p>
        </div>
      )}

      <button
        onClick={handleMicClick}
        disabled={loading || !wsConnected}
        className={`rounded-full p-6 text-4xl transition-all transform ${
          recording
            ? "bg-rose-500 hover:bg-rose-600 scale-110 animate-pulse shadow-2xl"
            : isPlaying
            ? "bg-orange-400 hover:bg-orange-500 shadow-2xl"
            : loading || !wsConnected
            ? "bg-gray-400 cursor-not-allowed shadow-2xl"
            : "bg-pink-400 hover:bg-pink-500 hover:scale-105 shadow-2xl"
        }`}
      >
        {recording ? "⏹️" : isPlaying ? "🔊" : "🎤"}
      </button>

      {recording && (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse" />
          <p className="text-lg font-bold text-rose-500">Listening...</p>
        </div>
      )}

      {isPlaying && (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse" />
          <p className="text-lg font-bold text-orange-500">Playing...</p>
        </div>
      )}
    </div>
  </div>
  )
}