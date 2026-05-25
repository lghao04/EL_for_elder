# 📚 English Learning Platform ( ZeroToOne)

Một nền tảng học tiếng Anh toàn diện tích hợp AI, hỗ trợ 4 kỹ năng: **Listening**, **Speaking**, **Reading**, và **Writing**.

---

## 🌟 Tính năng tổng quan

| Kỹ năng | Mô tả |
|---|---|
| 🎧 Listening | Luyện nghe với bài tập trắc nghiệm, điều chỉnh tốc độ audio |
| 🎤 Speaking | Hội thoại AI thời gian thực với nhận diện giọng nói |
| 📖 Reading | Đọc hiểu văn bản với câu hỏi kèm theo |
| ✍️ Writing | Luyện viết theo chủ đề với chấm điểm AI chi tiết |

---

## 🛠️ Tech Stack

### Backend
- **Framework:** FastAPI (Python)
- **Server:** Uvicorn
- **AI / LLM:** [Groq](https://groq.com) — dùng cho Speaking, Writing, và sinh phương án câu hỏi Listening
- **Speech-to-Text:** [Deepgram](https://deepgram.com) — chuyển đổi giọng nói của user sang văn bản
- **Text-to-Speech:** Groq TTS — trả về audio dạng base64, phát trực tiếp không lưu file
- **Image Storage:** [Cloudinary](https://cloudinary.com) — lưu trữ ảnh đại diện người dùng

### Frontend
- **Framework:** React + TypeScript (`.tsx`)
- **Dev server:** `npm run dev`

### Datasets
- **Listening:** Crawl từ [ESL Lab](https://www.esl-lab.com) — gồm audio, script, câu hỏi gốc; AI sinh thêm phương án nhiễu và đối chiếu với script để đảm bảo đáp án chính xác
- **Reading:** [MCTest dataset](https://github.com/mcobzarenco/mctest) — script + câu hỏi đa lựa chọn
- **Writing:** [Quora Question-Answer dataset](https://huggingface.co/datasets/toughdata/quora-question-answer-dataset) — làm nguồn topic ngẫu nhiên / tìm kiếm

---

## 🚀 Cài đặt & Chạy

### Yêu cầu
- Python 3.9+
- Node.js 18+
- Các API key: Groq, Deepgram, Cloudinary

### 1. Clone repo

```bash
git clone <repo-url>
cd <project-folder>
```

### 2. Cấu hình biến môi trường

Tạo file `.env` ở thư mục backend với nội dung:

```env
GROQ_API_KEY=your_groq_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
DATABASE_URL=your_database_url
```

### 3. Chạy Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend mặc định chạy tại: `http://localhost:8000`

### 4. Chạy Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend mặc định chạy tại: `http://localhost:5173`

---

## 📂 Cấu trúc dự án

```
project/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env
│   ├── routers/
│   │   ├── listening.py
│   │   ├── speaking.py
│   │   ├── reading.py
│   │   ├── writing.py
│   │   └── user.py
│   ├── services/
│   │   ├── groq_service.py
│   │   ├── deepgram_service.py
│   │   └── cloudinary_service.py
│   └── models/
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Listening/
    │   │   ├── Speaking/
    │   │   ├── Reading/
    │   │   └── Writing/
    │   ├── components/
    │   └── App.tsx
    ├── package.json
    └── tsconfig.json
```

---

## 🎧 Listening

### Luồng hoạt động
1. Hiển thị danh sách bài học crawl từ ESL Lab
2. User chọn bài → vào giao diện làm bài
3. Giao diện làm bài gồm:
   - Audio player với **điều chỉnh tốc độ phát** (0.5x → 2x)
   - Danh sách câu hỏi trắc nghiệm
   - Submit → hiển thị **điểm số** và đáp án đúng

### Dataset
- Nguồn: crawl từ [ESL Lab](https://www.esl-lab.com)
- Cấu trúc mỗi bài: `audio`, `script`, `câu hỏi gốc`
- Phương án nhiễu (A/B/C/D) được **AI (Groq) sinh tự động** và **đối chiếu với script** để đảm bảo đáp án luôn chính xác

---

## 🎤 Speaking

### Luồng hoạt động
1. Giao diện dạng **chat conversation**
2. User nhấn ghi âm → gửi file audio lên backend
3. Backend dùng **Deepgram** chuyển audio → text
4. Text của user hiển thị lên giao diện chat + đưa vào prompt gửi **Groq LLM**
5. LLM phản hồi → text phản hồi hiển thị trên chat
6. Đồng thời: text phản hồi được chuyển sang **audio base64** và phát ngay (không lưu file cố định)

---

## 📖 Reading

### Luồng hoạt động
1. Hiển thị danh sách bài học từ dataset MCTest
2. User chọn bài → vào giao diện làm bài
3. Giao diện gồm:
   - Hiển thị **đoạn văn (script)**
   - Các **câu hỏi trắc nghiệm** bên dưới
   - Submit → hiển thị **điểm số**

### Dataset
- Nguồn: [MCTest](https://github.com/mcobzarenco/mctest)
- Cấu trúc: `script` + `câu hỏi` + `đáp án`

---

## ✍️ Writing

### Chế độ bắt đầu
- **Bắt đầu ngay:** Topic được chọn **ngẫu nhiên** từ dataset Quora
- **Tìm kiếm:** User nhập keyword → hiển thị danh sách topic có chứa keyword → chọn topic để làm bài

### Giao diện làm bài
- Hiển thị **topic** ở trên
- Khu vực soạn thảo với các tùy chỉnh:
  - Font chữ
  - Cỡ chữ
  - Kích thước dòng (line height)
- Thanh thống kê phía dưới:
  - **Đếm từ** (word count)
  - **Đếm ký tự** (character count)
  - **Đồng hồ đếm ngược** — giới hạn **20 phút**

### Chấm điểm AI (Groq)
Sau khi submit, AI phân tích bài viết và trả về:

```json
{
  "ratings": {
    "taskAchievement": 0,
    "coherenceCohesion": 0,
    "lexicalResource": 0,
    "grammaticalRange": 0
  },
  "overallFeedback": "...",
  "grammarErrors": [],
  "rewrittenSentences": [],
  "topicCheck": "...",
  "encouragement": "..."
}
```

| Trường | Mô tả |
|---|---|
| `ratings` | 4 tiêu chí chấm điểm |
| `overallFeedback` | Nhận xét tổng quan |
| `grammarErrors` | Tối đa 5 lỗi ngữ pháp điển hình |
| `rewrittenSentences` | Tối đa 3 câu được viết lại tốt hơn |
| `topicCheck` | Kiểm tra bài có đúng chủ đề không |
| `encouragement` | Lời động viên cá nhân hóa |

---

## 👤 Hồ sơ người dùng & Gamification

### Hồ sơ (Profile)
- Chỉnh sửa thông tin cá nhân (tên, email, v.v.)
- Upload ảnh đại diện — lưu trữ qua **Cloudinary**

### Hệ thống điểm & Streak
- **Tổng điểm:** Tích lũy từ kết quả các bài Listening, Reading, Writing
- **Streak:** Theo dõi số ngày học liên tiếp
- **Bảng xếp hạng:** Top 5 người dùng có điểm số cao nhất

---

## 🔑 Các dịch vụ bên thứ ba

| Dịch vụ | Mục đích | Docs |
|---|---|---|
| [Groq](https://console.groq.com) | LLM cho Speaking, Writing, sinh câu hỏi Listening; TTS | [docs.groq.com](https://console.groq.com/docs) |
| [Deepgram](https://deepgram.com) | Speech-to-Text cho Speaking | [developers.deepgram.com](https://developers.deepgram.com) |
| [Cloudinary](https://cloudinary.com) | Lưu trữ ảnh đại diện | [cloudinary.com/docs](https://cloudinary.com/documentation) |

---

## 📝 Ghi chú

- Tất cả API key và thông tin nhạy cảm được quản lý qua file `.env` — **không commit file này lên git**
- Audio trong Speaking được xử lý hoàn toàn in-memory (base64), không lưu file trên server
- Đáp án câu hỏi Listening được đảm bảo chính xác nhờ đối chiếu với script gốc trước khi lưu vào dataset
