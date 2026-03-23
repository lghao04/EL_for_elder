"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { MessageCircle, Mic } from "lucide-react"

interface ReadTabProps {
  difficulty: string
}

export default function ReadTab({ difficulty }: ReadTabProps) {
  const router = useRouter()
  const [isRecording, setIsRecording] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [isPlayingSample, setIsPlayingSample] = useState(false)


  const handleStartPractice = () => {
    router.push("/read")
  }

  

}
