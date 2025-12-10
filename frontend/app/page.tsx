"use client"

import { useState } from "react"
import Header from "./../components/header"
import MainContent from "./../components/main-content"
import RightSidebar from "./../components/right-sidebar"
import { useLanguage } from "./../hooks/use-language"

export default function Home() {
  const [activeTab, setActiveTab] = useState("listen")
  const [difficulty, setDifficulty] = useState("normal")
  const { language, setLanguage } = useLanguage()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header userAvatar="👤" onLanguageChange={setLanguage} currentLanguage={language} />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden gap-6 p-6 max-w-7xl mx-auto w-full">
        {/* Left/Center - Main Content */}
        <div className="flex-1 min-w-0">
          <MainContent activeTab={activeTab} setActiveTab={setActiveTab} difficulty={difficulty} />
        </div>

        {/* Right Sidebar - Progress Stats */}
        <RightSidebar difficulty={difficulty} setDifficulty={setDifficulty} />
      </div>
    </div>
  )
}
