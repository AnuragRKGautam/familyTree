# Chart prototype limitations (`family-chart@0.9.0`)

Local prototype route: `/prototype` (no auth, fictional in-memory data).

## APIs used (documented only)

- `createChart`, `setCardHtml`, `setCardDisplay`, `setOnCardClick`
- `setAncestryDepth`, `setProgenyDepth`, `setShowSiblingsOfMain`
- `setSingleParentEmptyCard`
- `updateMainId`, `updateData`, `updateTree({ tree_position })`
- Fit: `updateTree({ tree_position: 'fit' })`
- Focus/center: `updateMainId` + `updateTree({ tree_position: 'main_to_middle' })`
- Zoom/pan: built-in D3 zoom on the chart SVG (wheel + drag). No dedicated `Chart.setZoom` in 0.9.0.

## Multiple partners

Partnerships map to bidirectional `rels.spouses`. The free library stacks every spouse on **one** side of a person. Our adapter runs `balanceMultipleSpouses` in `chart.beforeUpdate` so two or more spouses alternate **left and right** of the person (so children of each co-parent hang under the clearer side). Ordering still follows `rels.spouses` / `sortChildrenWithSpouses`. There is no separate “ex-spouse” styling.

## Adoptive relationships

Our domain stores `ParentChild.kind = 'biological' | 'adoptive'`. The free core has **no distinct adoptive line style**. The profile side panel still lists every parent link with its kind.

**Library constraint:** with `setSingleParentEmptyCard(true)`, family-chart throws `child has more than 1 parent` if a child has anything other than 0→1 or exactly 1 parent when synthesizing an empty co-parent — and in practice the layout assumes **at most two** parents. Our adapter therefore sends **at most two** parent edges to the chart (preferring an adoptive pair when present). Extra parents remain domain-only (visible in the profile panel).

## Focusing a person and visible relatives

Yes — focusing changes the visible neighborhood. The library rebuilds the tree around the **main** person using ancestry/progeny depth (`setAncestryDepth` / `setProgenyDepth`). Relatives outside those depths, and entire **disconnected branches**, are hidden until that branch’s person becomes main (e.g. search → focus on an Ash family member).

## Generation filtering without premium

Partial / depth-only, not full filter UI:

| Need | Free core |
|------|-----------|
| Limit ancestors/descendants shown | `setAncestryDepth` / `setProgenyDepth` |
| Show siblings of main | `setShowSiblingsOfMain` |
| Kinship labels / advanced filtering demos | Marketed on **family-chart-premium** — do not use |
| Name search | App-side (our prototype search) |

So: generation **depth** can be limited without premium; rich “filter tree by generation band / kinship engine” features should not be assumed in the free library.

## Unknown parents

People with only one (or zero) recorded parents omit the missing parent edge. `setSingleParentEmptyCard(true, { label: 'Unknown parent' })` asks the library to show an empty parent card when appropriate.

## Disconnected branches

Included as the Ash family with no edges into Willow/Hale/Ortega. They appear when focused; they do not appear while browsing the Willow-centered tree.

## Repeated names

Example: two **James Hale** individuals and two **Margaret** first names (Willow matriarch vs Margaret Hale). Distinguish via profile biography, birth year, and stable ids — not by display name alone.

## React Strict Mode

`FamilyChart` creates the controller once per mount and calls `destroy()` (clears container DOM) on unmount so Strict Mode’s mount→unmount→remount cycle does not leak duplicate charts or listeners.

## Relationship lines on a light background

The library paints link paths with hardcoded `stroke="#fff"` (for its dark chart background). On our light UI those lines looked missing. CSS in `src/index.css` overrides `path.link` to a dark stroke so linkages stay visible.
