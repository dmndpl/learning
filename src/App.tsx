import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, Menu, RotateCcw, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { courses } from './content'
import type { Course, Lecture } from './types'

type View =
  | { kind: 'home' }
  | { kind: 'course'; course: Course }
  | { kind: 'lecture'; course: Course; lecture: Lecture }
  | { kind: 'quiz'; course: Course; lecture: Lecture }

const loadProgress = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem('fieldnotes-progress') ?? '{}') }
  catch { return {} }
}

function App() {
  const [view, setView] = useState<View>({ kind: 'home' })
  const [progress, setProgress] = useState(loadProgress)
  const [menuOpen, setMenuOpen] = useState(false)

  const navigate = (next: View) => {
    setView(next)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveScore = (lectureId: string, score: number) => {
    const next = { ...progress, [lectureId]: Math.max(progress[lectureId] ?? 0, score) }
    setProgress(next)
    localStorage.setItem('fieldnotes-progress', JSON.stringify(next))
  }

  return (
    <div className="app-shell">
      <Header onHome={() => navigate({ kind: 'home' })} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main>
        {view.kind === 'home' && <Home onCourse={(course) => navigate({ kind: 'course', course })} progress={progress} />}
        {view.kind === 'course' && <CoursePage course={view.course} progress={progress} onBack={() => navigate({ kind: 'home' })} onLecture={(lecture) => navigate({ kind: 'lecture', course: view.course, lecture })} onQuiz={(lecture) => navigate({ kind: 'quiz', course: view.course, lecture })} />}
        {view.kind === 'lecture' && <LecturePage course={view.course} lecture={view.lecture} onBack={() => navigate({ kind: 'course', course: view.course })} onQuiz={() => navigate({ kind: 'quiz', course: view.course, lecture: view.lecture })} />}
        {view.kind === 'quiz' && <QuizPage lecture={view.lecture} bestScore={progress[view.lecture.id]} onBack={() => navigate({ kind: 'course', course: view.course })} onRead={() => navigate({ kind: 'lecture', course: view.course, lecture: view.lecture })} onComplete={(score) => saveScore(view.lecture.id, score)} />}
      </main>
      <footer><span>FIELDNOTES / PERSONAL LEARNING SYSTEM</span><span>Built for deliberate practice.</span></footer>
    </div>
  )
}

function Header({ onHome, menuOpen, setMenuOpen }: { onHome: () => void; menuOpen: boolean; setMenuOpen: (open: boolean) => void }) {
  return <header className="site-header">
    <button className="brand" onClick={onHome} aria-label="Go home"><span className="brand-mark">F</span><span>FIELDNOTES</span></button>
    <nav className={menuOpen ? 'open' : ''}>
      <button onClick={onHome}>Library</button>
      <span>Backend engineering</span>
    </nav>
    <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X /> : <Menu />}</button>
  </header>
}

function Home({ onCourse, progress }: { onCourse: (course: Course) => void; progress: Record<string, number> }) {
  const lectureCount = courses.reduce((sum, course) => sum + course.lectures.length, 0)
  return <>
    <section className="hero">
      <div className="eyebrow">PERSONAL KNOWLEDGE LIBRARY <span /></div>
      <h1>Learn the systems<br />behind the <em>software.</em></h1>
      <p>Thoughtful notes and active recall for building a deeper understanding of backend engineering.</p>
      <div className="hero-stats"><div><strong>{String(courses.length).padStart(2, '0')}</strong><span>COURSES</span></div><div><strong>{String(lectureCount).padStart(2, '0')}</strong><span>LECTURES</span></div><div><strong>{Object.keys(progress).length}</strong><span>TESTS TAKEN</span></div></div>
    </section>
    <section className="library page-width">
      <div className="section-heading"><div><span className="kicker">AREA OF INTEREST / 01</span><h2>Backend Engineering</h2></div><p>Designing reliable foundations for modern applications.</p></div>
      <div className="course-grid">
        {courses.map((course, index) => <button className="course-card" onClick={() => onCourse(course)} key={course.id}>
          <div className="card-top"><span>0{index + 1}</span><ArrowRight /></div>
          <div><span className="course-meta">COURSE · {course.lectures.length || 'COMING SOON'} {course.lectures.length === 1 ? 'LECTURE' : 'LECTURES'}</span><h3>{course.title}</h3><p>{course.description}</p></div>
          <div className="card-rule"><span style={{ width: course.lectures.length ? '38%' : '8%' }} /></div>
        </button>)}
      </div>
    </section>
  </>
}

function CoursePage({ course, progress, onBack, onLecture, onQuiz }: { course: Course; progress: Record<string, number>; onBack: () => void; onLecture: (lecture: Lecture) => void; onQuiz: (lecture: Lecture) => void }) {
  return <div className="page-width inner-page">
    <button className="back-link" onClick={onBack}><ArrowLeft /> All courses</button>
    <div className="course-title"><span className="kicker">BACKEND ENGINEERING / COURSE</span><h1>{course.title}</h1><p>{course.description}</p></div>
    <div className="lecture-list">
      {course.lectures.length === 0 ? <div className="empty-state"><BookOpen /><h2>Notes coming soon</h2><p>Add a Markdown file to <code>backend/{course.id}</code> and it will appear here automatically.</p></div> : course.lectures.map((lecture, index) => <article className="lecture-row" key={lecture.id}>
        <div className="lecture-number">{String(index + 1).padStart(2, '0')}</div>
        <button className="lecture-main" onClick={() => onLecture(lecture)}><span>{lecture.week ? `WEEK ${lecture.week}` : 'LECTURE'} · {lecture.readingMinutes} MIN READ</span><h2>{lecture.title.replace(/^Week\s+\d+\s*[—–-]\s*/i, '')}</h2></button>
        <div className="lecture-actions"><button onClick={() => onLecture(lecture)}>Read <ChevronRight /></button>{lecture.quiz.length > 0 && <button className="test-button" onClick={() => onQuiz(lecture)}><CircleHelp /> Test yourself {progress[lecture.id] !== undefined && <b>{progress[lecture.id]}%</b>}</button>}</div>
      </article>)}
    </div>
  </div>
}

function LecturePage({ course, lecture, onBack, onQuiz }: { course: Course; lecture: Lecture; onBack: () => void; onQuiz: () => void }) {
  return <div className="reading-layout">
    <aside><button className="back-link" onClick={onBack}><ArrowLeft /> {course.title}</button><div><span className="kicker">IN THIS LECTURE</span><p>{lecture.title}</p><span>{lecture.readingMinutes} minute read</span></div>{lecture.quiz.length > 0 && <button className="aside-test" onClick={onQuiz}>Test your recall <ArrowRight /></button>}</aside>
    <article className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{lecture.content}</ReactMarkdown>{lecture.quiz.length > 0 && <div className="end-card"><span>READY TO CHECK YOUR UNDERSTANDING?</span><h2>Turn reading into recall.</h2><button onClick={onQuiz}>Start chapter test <ArrowRight /></button></div>}</article>
  </div>
}

function QuizPage({ lecture, bestScore, onBack, onRead, onComplete }: { lecture: Lecture; bestScore?: number; onBack: () => void; onRead: () => void; onComplete: (score: number) => void }) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const card = lecture.quiz[index]
  const answers = card?.answers ?? card?.aswners ?? {}
  const multi = card?.correct.length > 1

  useEffect(() => { window.scrollTo({ top: 0 }) }, [index])
  const isCorrect = useMemo(() => card ? selected.length === card.correct.length && selected.every((answer) => card.correct.includes(answer)) : false, [card, selected])
  const choose = (key: string) => {
    if (submitted) return
    setSelected(multi ? (selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]) : [key])
  }
  const submit = () => { if (!selected.length) return; setSubmitted(true); if (isCorrect) setCorrectCount((count) => count + 1) }
  const next = () => {
    if (index === lecture.quiz.length - 1) {
      const score = Math.round(((correctCount + (isCorrect ? 1 : 0)) / lecture.quiz.length) * 100)
      onComplete(score); setFinished(true); return
    }
    setIndex(index + 1); setSelected([]); setSubmitted(false)
  }
  const restart = () => { setIndex(0); setSelected([]); setSubmitted(false); setCorrectCount(0); setFinished(false) }

  if (!card) return <div className="page-width inner-page"><button className="back-link" onClick={onBack}><ArrowLeft /> Course</button><div className="empty-state"><h2>No test available</h2></div></div>
  if (finished) {
    const score = Math.round((correctCount / lecture.quiz.length) * 100)
    return <div className="quiz-shell result"><span className="kicker">CHAPTER COMPLETE</span><div className="score-ring"><strong>{score}</strong><span>%</span></div><h1>{score >= 80 ? 'Nicely remembered.' : 'A useful first pass.'}</h1><p>You answered {correctCount} of {lecture.quiz.length} questions correctly.{bestScore !== undefined ? ` Your best score is ${Math.max(score, bestScore)}%.` : ''}</p><div className="result-actions"><button onClick={restart}><RotateCcw /> Try again</button><button onClick={onRead}>Review lecture</button><button onClick={onBack}>Back to course</button></div></div>
  }
  return <div className="quiz-shell">
    <div className="quiz-header"><button className="back-link" onClick={onBack}><X /> Exit test</button><span>{String(index + 1).padStart(2, '0')} / {String(lecture.quiz.length).padStart(2, '0')}</span></div>
    <div className="progress-track"><span style={{ width: `${((index + 1) / lecture.quiz.length) * 100}%` }} /></div>
    <section className="question-card"><span className="kicker">{multi ? 'SELECT ALL THAT APPLY' : 'SELECT ONE ANSWER'}</span><h1>{card.question}</h1><div className="answers">{Object.entries(answers).map(([key, answer]) => {
      const chosen = selected.includes(key); const right = submitted && card.correct.includes(key); const wrong = submitted && chosen && !right
      return <button key={key} onClick={() => choose(key)} className={`${chosen ? 'selected' : ''} ${right ? 'correct' : ''} ${wrong ? 'wrong' : ''}`}><span>{key}</span><p>{answer}</p>{right && <Check />}{wrong && <X />}</button>
    })}</div>
    {submitted && <div className={`feedback ${isCorrect ? 'good' : 'bad'}`}><strong>{isCorrect ? 'Correct.' : 'Not quite.'}</strong><span>{isCorrect ? '' : `Correct answer${card.correct.length > 1 ? 's are' : ' is'} ${card.correct.join(', ')}.`}</span></div>}
    <div className="quiz-action"><button disabled={!selected.length} onClick={submitted ? next : submit}>{submitted ? (index === lecture.quiz.length - 1 ? 'See results' : 'Next question') : 'Check answer'} <ArrowRight /></button></div>
    </section>
  </div>
}

export default App
