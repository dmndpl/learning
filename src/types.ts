export type AnswerMap = Record<string, string>

export interface QuizCard {
  question: string
  answers?: AnswerMap
  aswners?: AnswerMap
  correct: string[]
}

export interface Lecture {
  id: string
  title: string
  week: number | null
  content: string
  quiz: QuizCard[]
  readingMinutes: number
}

export interface Course {
  id: string
  title: string
  description: string
  lectures: Lecture[]
}
