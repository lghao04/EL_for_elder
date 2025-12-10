"use client"

interface HeaderProps {
  userAvatar: string
  onLanguageChange: (lang: string) => void
  currentLanguage: string
}

export default function Header({ userAvatar, onLanguageChange, currentLanguage }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 shadow-sm">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Logo and App Name */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white rounded-lg px-3 py-2 font-bold text-lg">SF</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SpeakFlow</h1>
            <p className="text-sm text-gray-500">Master English Today</p>
          </div>
        </div>

        {/* Right section: Language and Avatar */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => onLanguageChange(currentLanguage === "en" ? "vi" : "en")}
            className="text-gray-700 font-medium text-sm hover:text-blue-600 transition"
          >
            {currentLanguage === "en" ? "VN Tiếng Việt" : "EN English"}
          </button>
          <button className="bg-orange-400 rounded-full p-3 text-xl hover:bg-orange-500 transition shadow-md">
            👤
          </button>
        </div>
      </div>
    </header>
  )
}
