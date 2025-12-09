"use client"

interface HeaderProps {
  userAvatar: string
  onLanguageChange: (lang: string) => void
  currentLanguage: string
}

export default function Header({ userAvatar, onLanguageChange, currentLanguage }: HeaderProps) {
  return (
    <header className="bg-gradient-to-r from-blue-400 to-purple-400 shadow-lg px-8 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Logo and App Name */}
        <div className="flex items-center gap-4">
          <div className="text-5xl">🎤</div>
          <div>
            <h1 className="text-4xl font-bold text-white">SpeakFlow</h1>
            <p className="text-lg text-blue-50">Learn English Together</p>
          </div>
        </div>

        {/* Right section: Language and Avatar */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => onLanguageChange(currentLanguage === "en" ? "vi" : "en")}
            className="bg-white text-blue-600 px-6 py-3 rounded-full font-bold text-lg hover:bg-blue-50 transition shadow-md"
          >
            {currentLanguage === "en" ? "🇻🇳 Tiếng Việt" : "🇬🇧 English"}
          </button>
          <button className="bg-yellow-300 rounded-full p-4 text-4xl hover:bg-yellow-200 transition shadow-md">
            {userAvatar}
          </button>
        </div>
      </div>
    </header>
  )
}
