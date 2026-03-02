import { Link, useLocation } from 'react-router-dom'

export default function NotFound() {
  const location = useLocation()

  return (
    <section className="panel">
      <h1>404</h1>
      <p>
        No route matches <code>{location.pathname}</code>
      </p>
      <p>
        <Link to="/play">Back to play</Link>
      </p>
    </section>
  )
}
