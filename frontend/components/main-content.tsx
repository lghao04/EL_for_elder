// frontend\components\main-content.tsx
"use client"
import ListenTab from "./../components/tabs/listen-tab"
import SpeakTab from "./../components/tabs/speak-tab"
import ReadTab from "./../components/tabs/read-tab"
import WriteTab from "./../components/tabs/write-tab"

interface MainContentProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  difficulty: string
}

export default function MainContent({ activeTab, setActiveTab, difficulty }: MainContentProps) {

   const tabs = [
    { id: "listen", label: "Listening" },
    { id: "speak", label: "Speaking" },
    { id: "read", label: "Reading" },
    { id: "write", label: "Writing" },
  ]

 return (
    <div className="flex flex-col gap-6 flex-1">
      {/* Tab Bar */}
      <div className="flex gap-3 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-pink-400 to-pink-500 text-white shadow-md scale-105"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "listen" && <ListenTab />}
        {activeTab === "speak" && <SpeakTab difficulty={difficulty} />}
        {activeTab === "read" && <ReadTab />}
        {activeTab === "write" && <WriteTab difficulty={difficulty} />}
      </div>
    </div>
  )
}
