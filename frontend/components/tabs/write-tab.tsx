"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { Rocket } from "lucide-react"

interface WriteTabProps {
  difficulty: string
}

export default function WriteTab({ difficulty }: WriteTabProps) {
  const router = useRouter()

  const handleStartWriting = () => {
    router.push("/write")
  }

  return (
    <div className="min-h-screen bg-blue-200 rounded-3xl p-8 md:p-12 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-4 right-8 text-3xl opacity-60 animate-bounce">*</div>
      <div className="absolute top-16 right-20 text-2xl opacity-40">✦</div>
      <div className="absolute bottom-20 left-10 text-2xl opacity-50 animate-pulse">✦</div>
      <div className="absolute top-32 left-16 text-xl opacity-40">*</div>

      <div className="relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-2">StoryFlow</h2>
          <p className="text-lg text-white/80">Write your story, poem, or thoughts here!</p>
        </div>

        {/* Main Content */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
          {/* Character */}
          <div className="flex-shrink-0">
            <Image
              src="/images/writing-cat.jpg"
              alt="Cute cat with laptop"
              width={300}
              height={300}
              className="drop-shadow-lg"
              priority
            />
          </div>

          {/* Content Box */}
          <div className="flex-1 max-w-md">
            {/* Speech Bubble */}
            <div className="bg-white rounded-3xl p-8 mb-8 relative shadow-lg">
              <div className="absolute -left-4 top-8 w-0 h-0 border-l-8 border-r-0 border-t-8 border-b-0 border-l-transparent border-t-white"></div>
              <p className="text-lg md:text-xl text-gray-800 font-medium">
                <span className="text-2xl mr-2">💭</span>
                What will you create? Type your story, poem, or thoughts here!
              </p>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartWriting}
              className="w-full bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-2xl py-6 px-8 rounded-full shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-3 group"
            >
              <Rocket className="w-8 h-8 group-hover:rotate-12 transition-transform" />
              <span>START WRITING!</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
