// lib/feedback-scoring.ts
// ─────────────────────────────────────────────────────────────────────────────
// Types mirror the backend WritingFeedback Pydantic model exactly.
// The old generateFeedback() local function has been removed —
// all scoring is now done by the AI via POST /api/writing/feedback/grade.
// ─────────────────────────────────────────────────────────────────────────────

export interface RatingItem {
  stars: number   // 1–5
  label: string   // "Excellent" | "Good" | "Improving" | "Basic" | "Needs work"
  comment: string // brief explanation shown under the stars
}

export interface GrammarError {
  original: string    // exact wrong phrase from the essay
  corrected: string   // suggested fix
  explanation: string // simple A2-B1 level reason
}

export interface RewrittenSentence {
  original: string  // awkward sentence from the essay
  improved: string  // natural rewrite
  tip: string       // why the rewrite is better
}

export interface TopicCheck {
  isOnTopic: boolean
  comment: string
}

export interface Ratings {
  topic: RatingItem
  grammar: RatingItem
  vocabulary: RatingItem
  naturalEnglish: RatingItem
}

/** Highlight span — char offsets into the original essay string */
export interface HighlightSpan {
  start: number                   // inclusive char offset
  end: number                     // exclusive char offset
  type: "grammar" | "spelling"
  original: string                // the wrong text (same as essay.slice(start, end))
  corrected: string               // suggested fix (for tooltip)
  explanation: string             // short reason (for tooltip)
}

/** Root feedback type — stored in sessionStorage and consumed by FeedbackPage */
export interface FeedbackData {
  essay: string                       // original essay text (added by the client before storing)
  topic: string                       // the prompt used, so "Write Again" can reuse it
  ratings: Ratings
  overallFeedback: string
  grammarErrors: GrammarError[]
  rewrittenSentences: RewrittenSentence[]
  topicCheck: TopicCheck
  encouragement: string
  highlights: HighlightSpan[]         // pre-computed by backend for inline highlighting
}