import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <main className="container">
      <h1>GoodGame</h1>
      <p>React + Vite + TypeScript</p>
      <p>
        <Link to="/missing">Go to 404 demo</Link>
      </p>
    </main>
  )
}
