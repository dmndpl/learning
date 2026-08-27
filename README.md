# Alexandria

Alexandria is a local React application for reading technical learning materials and testing recall with chapter-based multiple-choice quizzes.

The source of truth is the `backend/` directory. Markdown files become lectures, and JSON files become tests. The application discovers these files at build time, so adding learning material does not normally require changing React code.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- A modern web browser

The project was initially verified with Node.js 24 and npm 11.

## Run locally

Install the dependencies once:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Vite prints the local address, normally `http://localhost:5173`. The server reloads when source code or learning materials change. Stop it with `Ctrl+C`.

To expose it to other devices on your local network:

```bash
npm run dev -- --host
```

## Operational commands

Check code quality:

```bash
npm run lint
```

Create a production build in the generated, ignored `dist/` directory:

```bash
npm run build
```

Preview that production build:

```bash
npm run preview
```

Review and install dependency updates:

```bash
npm outdated
npm update
npm run lint
npm run build
```

Commit `package-lock.json` whenever dependency versions change so installations remain reproducible.

## Content structure

Learning materials use this hierarchy:

```text
backend/
  <course>/
    <lecture>.md
    <matching-quiz>.json
```

The current example is:

```text
backend/
  api_design/
    Week 1 - APIs as Contracts.md
    week1_cards.json
  schema_design/
    .gitkeep
```

`backend` is displayed as the **Backend Engineering** area. Each directory directly beneath it is a course, and each Markdown file inside a course is a lecture.

## Add a lecture

Create a Markdown file inside the relevant course:

```text
backend/api_design/Week 2 - Compatibility.md
```

The first level-one heading is used as the displayed title:

```markdown
# Week 2 — Compatibility

## Learning objectives

By the end of this chapter, you should be able to...
```

Standard Markdown, tables, task lists, and fenced code blocks are supported. Lecture order comes from the week number in the filename. Files without a recognisable week number appear after numbered lectures.

## Add a quiz

Create a JSON file in the same course. Include the same week number as the lecture so the app can pair them:

```text
backend/api_design/Week 2 - Compatibility.md
backend/api_design/week2_cards.json
```

The quiz must be a JSON array:

```json
[
  {
    "question": "Which change is usually backwards compatible?",
    "answers": {
      "A": "Removing a required response field",
      "B": "Adding an optional response field",
      "C": "Changing an identifier's meaning"
    },
    "correct": ["B"]
  }
]
```

For a multi-select question, include every correct key:

```json
{
  "question": "Which properties can form an operational contract?",
  "answers": {
    "A": "Availability",
    "B": "Latency",
    "C": "Rate limits",
    "D": "Database table names"
  },
  "correct": ["A", "B", "C"]
}
```

One correct key produces a single-choice question. Multiple keys automatically produce “select all that apply.”

New material appears after the development server reloads. Run `npm run build` before committing to catch malformed JSON or integration errors.

## Add a course

Create a directory beneath `backend/`, then add a Markdown lecture:

```text
backend/distributed_systems/Week 1 - Failure Is Normal.md
```

Unknown names are converted from snake case to title case, so `distributed_systems` displays as “Distributed Systems.” It receives a generic description.

To provide a curated title and description, add an entry to `courseDetails` in `src/content.ts`:

```ts
distributed_systems: {
  title: 'Distributed Systems',
  description: 'Reason about coordination, failure, and consistency.',
},
```

An empty course must also be declared in `courseDetails`; completely empty directories cannot be discovered by Vite. A `.gitkeep` preserves an empty directory in Git but does not create its display metadata.

## Assumptions and conventions

- All current learning content belongs to the Backend Engineering area.
- A direct child directory of `backend/` represents one course.
- Course directories use stable names such as `api_design`.
- Markdown and JSON files are direct children of a course; nested chapter directories are not modelled.
- One Markdown file represents exactly one lecture.
- The first `#` heading is the title; the filename is the fallback.
- Lecture and quiz filenames contain a week number such as `Week 1`, `week1`, or `week_1`.
- A quiz is matched by course directory and week number, not exact filename.
- There should be at most one quiz per week in a course. If duplicates exist, the first discovered file wins.
- Quiz files are arrays of multiple-choice cards using the documented structure.
- Keys in `correct` exactly match keys in `answers`.
- The existing misspelled `aswners` property remains supported for backwards compatibility. New quizzes should use `answers`.
- Content is bundled at development/build time. There is no server, database, authentication, or content-management interface.
- Best test percentages are stored in browser `localStorage` under `fieldnotes-progress`.
- Scores are browser-specific and disappear if site data is cleared. Reading progress is not tracked.
- Correct answers ship in the browser bundle. This is intended for personal study, not secure assessment.
- The app targets current desktop and mobile browsers with JavaScript enabled.

## Troubleshooting

### A lecture does not appear

Confirm the file ends in `.md`, is directly inside a course directory, and the terminal shows no parsing errors. Restart `npm run dev` if a newly created directory is not detected.

### A quiz does not appear

Confirm the JSON is in the same course as its lecture, both filenames contain the same week number, the JSON is valid, and its top-level value is an array.

### Reset saved scores

Run this in the browser developer console:

```js
localStorage.removeItem('fieldnotes-progress')
location.reload()
```

### A port is already in use

Vite normally chooses another port. To request one explicitly:

```bash
npm run dev -- --port 4173
```

## Recommended content workflow

1. Add or edit the Markdown lecture.
2. Add its matching quiz JSON.
3. Run `npm run dev` and review the rendered lecture.
4. Complete the quiz, including multi-select questions.
5. Run `npm run lint` and `npm run build`.
6. Commit the content files and intentional app changes.
