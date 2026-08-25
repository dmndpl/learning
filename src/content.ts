import type { Course, QuizCard } from './types'

const markdownFiles = import.meta.glob('../backend/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const quizFiles = import.meta.glob('../backend/**/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, QuizCard[]>

const courseDetails: Record<string, { title: string; description: string }> = {
  api_design: {
    title: 'API Design',
    description: 'Design durable interfaces, clear contracts, and systems that can evolve.',
  },
  schema_design: {
    title: 'Schema Design',
    description: 'Model data with intention, from first principles to production trade-offs.',
  },
}

const titleFromMarkdown = (content: string, fallback: string) =>
  content.match(/^#\s+(.+)$/m)?.[1]?.replace(/[—–]/g, '—') ?? fallback.replace(/\.md$/, '')

const weekNumber = (value: string) => {
  const match = value.match(/week\s*[-_ ]?(\d+)/i)
  return match ? Number(match[1]) : null
}

const courseIds = new Set([
  ...Object.keys(courseDetails),
  ...Object.keys(markdownFiles).map((path) => path.split('/')[2]),
])

export const courses: Course[] = [...courseIds].map((id) => {
  const details = courseDetails[id] ?? {
    title: id.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    description: 'A growing collection of notes and exercises.',
  }

  const lectures = Object.entries(markdownFiles)
    .filter(([path]) => path.split('/')[2] === id)
    .map(([path, content]) => {
      const filename = path.split('/').at(-1) ?? path
      const week = weekNumber(filename)
      const quiz = Object.entries(quizFiles).find(([quizPath]) => {
        return quizPath.split('/')[2] === id && weekNumber(quizPath) === week
      })?.[1] ?? []

      return {
        id: `${id}-${filename}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        title: titleFromMarkdown(content, filename),
        week,
        content,
        quiz,
        readingMinutes: Math.max(1, Math.ceil(content.split(/\s+/).length / 220)),
      }
    })
    .sort((a, b) => (a.week ?? 999) - (b.week ?? 999))

  return { id, ...details, lectures }
})
