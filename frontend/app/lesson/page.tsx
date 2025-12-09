// "use client"

// import { useSearchParams, useRouter } from "next/navigation"
// import Header from "../../components/header"
// import LessonDetail from "../../components/lesson-detail"
// import { useState } from "react"


// export default function LessonPage() {
//   const searchParams = useSearchParams()
//   const router = useRouter()
//   const [currentLanguage, setCurrentLanguage] = useState("en")

//   const lessonId = searchParams.get("id") || "1"
//   const lessonTitle = searchParams.get("title") || "Hello and Goodbye"
//   const lessonTopic = searchParams.get("topic") || "Greetings"

//   const lesson = {
//     id: Number.parseInt(lessonId),
//     title: lessonTitle,
//     topic: lessonTopic,
//     difficulty: "easy" as const,
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-100 via-yellow-100 to-pink-100">
//       <Header userAvatar="👧" onLanguageChange={setCurrentLanguage} currentLanguage={currentLanguage} />

//       <div className="p-6">
//         <div className="max-w-4xl mx-auto">
//           <button
//             onClick={() => router.back()}
//             className="mb-6 bg-white px-6 py-3 rounded-xl font-bold text-lg text-gray-700 hover:bg-gray-100 transition shadow-lg border-3 border-gray-300"
//           >
//             ← Back to Lessons
//           </button>
//           <LessonDetail lesson={lesson} />
//         </div>
//       </div>
//     </div>
//   )
// }
"use client"

import { useSearchParams, useRouter } from "next/navigation"
import Header from "../../components/header"
import LessonDetail from "../../components/lesson-detail"
import { useState, useEffect } from "react" // <--- 1. Import thêm useEffect

// Định nghĩa kiểu dữ liệu cho Lesson (khớp với BE trả về)
interface LessonData {
  id: number;
  title: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  content?: string; // Ví dụ thêm trường nội dung bài học
}

export default function LessonPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [currentLanguage, setCurrentLanguage] = useState("en")

  // Lấy ID từ URL
  const lessonId = searchParams.get("id") || "1"

  // --- 2. Tạo State để lưu dữ liệu từ BE ---
  const [lesson, setLesson] = useState<LessonData | null>(null) 
  const [loading, setLoading] = useState(true) // Trạng thái đang tải
  const [error, setError] = useState("")

  // --- 3. Dùng useEffect để gọi API khi component được mount ---
  useEffect(() => {
    const fetchLessonData = async () => {
      try {
        setLoading(true)
        // Gọi API Backend Python của bạn
        const response = await fetch(`http://localhost:8000/lessons/${lessonId}`)

        
        if (!response.ok) {
          throw new Error("Không thể lấy dữ liệu bài học")
        }

        const data = await response.json()
        setLesson(data) // Lưu data vào state
      } catch (err) {
        console.error(err)
        setError("Có lỗi xảy ra khi tải bài học.")
      } finally {
        setLoading(false) // Tắt trạng thái loading dù thành công hay thất bại
      }
    }

    if (lessonId) {
      fetchLessonData()
    }
  }, [lessonId]) // Chạy lại nếu lessonId thay đổi

  // --- 4. Xử lý giao diện khi đang tải hoặc lỗi ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-xl font-bold text-blue-600 animate-pulse">Running AI Generator...</div>
      </div>
    )
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 font-bold">{error || "Lesson not found"}</div>
        <button onClick={() => router.back()} className="ml-4 underline">Quay lại</button>
      </div>
    )
  }

  // --- 5. Render giao diện chính khi đã có Data ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-yellow-100 to-pink-100">
      <Header userAvatar="👧" onLanguageChange={setCurrentLanguage} currentLanguage={currentLanguage} />

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-6 bg-white px-6 py-3 rounded-xl font-bold text-lg text-gray-700 hover:bg-gray-100 transition shadow-lg border-3 border-gray-300"
          >
            ← Back to Lessons
          </button>
          
          {/* Truyền dữ liệu thật vào component con */}
          <LessonDetail lesson={lesson} />
        </div>
      </div>
    </div>
  )
}