import { Link } from 'react-router-dom'

export function LimitationsPage() {
  return (
    <main className="page-panel prototype-limitations">
      <p>
        <Link to="/prototype">← Back to chart prototype</Link>
      </p>
      <h1>Chart prototype limitations</h1>
      <p className="lede">
        Based on installed <code>family-chart@0.9.0</code> documented APIs. Full notes also live in{' '}
        <code>docs/chart-prototype-limitations.md</code>.
      </p>

      <h2>Multiple partners</h2>
      <p>
        Mapped to bidirectional spouses. Partners render alongside the main person. No separate
        ex-spouse styling in this prototype.
      </p>

      <h2>Adoptive relationships</h2>
      <p>
        Domain tracks biological vs adoptive. The chart shows at most two parents (library
        limit); we prefer the adoptive pair when present. Full links (including biological)
        stay in the profile panel. There is no separate adoptive line style in the free core.
      </p>

      <h2>Focus changes visible relatives</h2>
      <p>
        Yes. The tree is rebuilt around the main person within ancestry/progeny depth. Disconnected
        branches (Ash family) stay hidden until you focus someone in that branch.
      </p>

      <h2>Generation filtering without premium</h2>
      <p>
        Depth limits via <code>setAncestryDepth</code> / <code>setProgenyDepth</code> are available
        in the free core. Advanced kinship filtering marketed on family-chart-premium is not used.
        Name search is implemented in our app, not by the library.
      </p>

      <h2>Fit / zoom / pan</h2>
      <p>
        Fit uses <code>updateTree</code> with <code>tree_position</code> set to{' '}
        <code>fit</code>. Zoom/pan use the library’s built-in D3 zoom (wheel + drag).
      </p>
    </main>
  )
}
