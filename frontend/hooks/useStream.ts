import { useRef, useState, useCallback, useEffect } from 'react'

interface StreamingSTTResult {
  partial: string  // Text đang nói (màu xám)
  final: string    // Text đã hoàn chỉnh (màu đen)
}

interface UseStreamingSTTOptions {
  language: string
  onError?: (error: string) => void
  onComplete?: (fullText: string) => void
}

export function useStreamingSTT({ language, onError, onComplete }: UseStreamingSTTOptions) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [transcript, setTranscript] = useState<StreamingSTTResult>({
    partial: '',
    final: ''
  })
  
  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  
  // Cleanup function
  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close()
      audioContextRef.current = null
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])
  
  const startStreaming = useCallback(async () => {
    try {
      // 1. Kết nối WebSocket
      const ws = new WebSocket(`ws://127.0.0.1:8000/api/ws/speech-to-text?language=${language}`)
      wsRef.current = ws
      
      ws.onopen = () => {
        console.log('✓ WebSocket connected')
      }
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        if (data.type === 'partial') {
          // Text tạm thời (đang nói)
          setTranscript(prev => ({
            ...prev,
            partial: data.text
          }))
        } else if (data.type === 'final') {
          // Text hoàn chỉnh (câu xong)
          setTranscript(prev => {
            const newFinal = (prev.final + ' ' + data.text).trim()
            return {
              partial: '',
              final: newFinal
            }
          })
        } else if (data.type === 'error') {
          console.error('STT error:', data.message)
          onError?.(data.message)
        }
      }
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        onError?.('Lỗi kết nối WebSocket')
        stopStreaming()
      }
      
      ws.onclose = () => {
        console.log('WebSocket closed')
        setIsStreaming(false)
      }
      
      // 2. Bắt đầu ghi âm
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
      
      // 3. Tạo AudioContext
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 16000 
      })
      audioContextRef.current = audioContext
      
      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source
      
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      
      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0)
          
          // Convert Float32 to Int16 PCM
          const pcmData = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]))
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
          
          // Gửi qua WebSocket
          ws.send(pcmData.buffer)
        }
      }
      
      source.connect(processor)
      processor.connect(audioContext.destination)
      
      setIsStreaming(true)
      setTranscript({ partial: '', final: '' })
      
    } catch (error) {
      console.error('Start streaming error:', error)
      onError?.('Không thể bắt đầu ghi âm. Vui lòng kiểm tra quyền microphone.')
      cleanup()
    }
  }, [language, onError, cleanup])
  
  const stopStreaming = useCallback(async () => {
    // Gửi lệnh finalize để lấy text cuối cùng
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command: 'finalize' }))
      
      // Đợi một chút để nhận final result
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    // Lấy full text trước khi cleanup
    const fullText = (transcript.final + ' ' + transcript.partial).trim()
    
    cleanup()
    setIsStreaming(false)
    
    // Callback với text hoàn chỉnh
    if (fullText) {
      onComplete?.(fullText)
    }
  }, [cleanup, transcript, onComplete])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])
  
  // Get full text (final + partial)
  const fullText = (transcript.final + ' ' + transcript.partial).trim()
  
  return {
    isStreaming,
    transcript,
    fullText,
    startStreaming,
    stopStreaming
  }
}