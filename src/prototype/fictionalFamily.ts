import type { FamilyGraph, Person } from './domain'

/**
 * Fictional Willow / Hale / Ortega family graph for local chart review.
 * ~36 people: four generations, siblings/cousins, unknown parents,
 * multiple partnerships, half-siblings, adoptive links, a disconnected
 * branch, and repeated names.
 */
export const fictionalFamily: FamilyGraph = {
  people: [
    // --- Generation 0 (eldest) ---
    p('g0-margaret', 'Margaret', 'Willow', 'female', 1920, 2001, 'Matriarch of the Willow line.'),
    p('g0-harold', 'Harold', 'Willow', 'male', 1918, 1995, 'Married Margaret; father of three.'),
    // Hale elders (parents of Frank & Margaret Hale — repeated first name Margaret)
    p('g0-agnes', 'Agnes', 'Hale', 'female', 1922, 1999, 'Hale elder; mother of Frank and Margaret Hale.'),
    p('g0-walter', 'Walter', 'Hale', 'male', 1920, 1988, 'Hale elder; father of Frank and Margaret Hale.'),

    // --- Generation 1 ---
    p('g1-eleanor', 'Eleanor', 'Willow', 'female', 1945, null, 'Eldest Willow sibling.'),
    p('g1-robert', 'Robert', 'Willow', 'male', 1947, 2010, 'Middle Willow sibling; two marriages.'),
    p('g1-diana', 'Diana', 'Willow', 'female', 1950, null, 'Youngest Willow sibling.'),
    p('g1-frank', 'Frank', 'Hale', 'male', 1944, 2012, 'Eleanor’s partner; sibling of Margaret Hale.'),
    p('g1-susan', 'Susan', 'Chen', 'female', 1952, null, 'Robert’s second partner.'),
    p('g1-miguel', 'Miguel', 'Ortega', 'male', 1948, null, 'Diana’s partner.'),
    p('g1-margaret-hale', 'Margaret', 'Hale', 'female', 1949, null, 'Repeated first name (with matriarch Margaret Willow); Frank’s sister.'),

    // --- Generation 2 ---
    p('g2-james-a', 'James', 'Hale', 'male', 1968, null, 'Eleanor + Frank; one of two James Hales.', ['Jim']),
    p('g2-james-b', 'James', 'Hale', 'male', 1970, null, 'Eleanor + Frank; repeated name with g2-james-a.'),
    p('g2-priya', 'Priya', 'Shah', 'female', 1971, null, 'Partner of James A.'),
    p('g2-lena', 'Lena', 'Willow', 'female', 1972, null, 'Robert + first partner (unknown); half-sibling to Noah.', ['Len']),
    p('g2-noah', 'Noah', 'Willow', 'male', 1980, null, 'Robert + Susan; half-sibling to Lena.'),
    p('g2-amelia', 'Amelia', 'Ortega', 'female', 1975, null, 'Diana + Miguel.'),
    p('g2-carlos', 'Carlos', 'Ortega', 'male', 1978, null, 'Diana + Miguel; cousin to the Hales/Willows.'),
    p('g2-sofia', 'Sofia', 'Reyes', 'female', 1979, null, 'Carlos’s partner.'),
    p('g2-adoptive-dad', 'Thomas', 'Brooks', 'male', 1965, null, 'Adoptive father of Maya.'),
    p('g2-adoptive-mom', 'Helen', 'Brooks', 'female', 1967, null, 'Adoptive mother of Maya.'),
    p('g2-maya', 'Maya', 'Brooks', 'female', 1990, null, 'Adopted by Thomas & Helen; biological child of Lena.'),
    p('g2-kevin', 'Kevin', 'Park', 'male', 1974, null, 'Lena’s later partner (second partnership).'),

    // --- Generation 3 ---
    p('g3-ava', 'Ava', 'Hale', 'female', 1995, null, 'James A + Priya.'),
    p('g3-ethan', 'Ethan', 'Hale', 'male', 1998, null, 'James A + Priya; sibling of Ava.'),
    p('g3-ruby', 'Ruby', 'Hale', 'female', 2001, null, 'James B’s child; mother unknown.'),
    p('g3-leo', 'Leo', 'Willow', 'male', 2002, null, 'Noah’s child; cousin to Ava/Ethan.'),
    p('g3-isla', 'Isla', 'Ortega', 'female', 2004, null, 'Carlos + Sofia; cousin generation.'),
    p('g3-owen', 'Owen', 'Ortega', 'male', 2006, null, 'Carlos + Sofia.'),
    p('g3-nina', 'Nina', 'Brooks', 'female', 2012, null, 'Maya’s daughter (adoptive line continues).'),

    // --- Disconnected "Ash" branch (no links to Willow/Hale/Ortega) ---
    p('x0-irene', 'Irene', 'Ash', 'female', 1935, 2015, 'Disconnected branch matriarch.'),
    p('x0-victor', 'Victor', 'Ash', 'male', 1933, 2008, 'Irene’s partner.'),
    p('x1-claire', 'Claire', 'Ash', 'female', 1960, null, 'Irene + Victor.'),
    p('x1-paul', 'Paul', 'Ash', 'male', 1962, null, 'Irene + Victor; sibling of Claire.'),
    p('x1-rita', 'Rita', 'Ng', 'female', 1963, null, 'Paul’s partner.'),
    p('x2-sam', 'Sam', 'Ash', 'unknown', 1990, null, 'Paul + Rita; no Willow connection.'),
    p('x2-jordan', 'Jordan', 'Ash', 'unknown', 1993, null, 'Paul + Rita; repeated surname Ash.'),
  ],

  partnerships: [
    { id: 'ps-g0', personAId: 'g0-margaret', personBId: 'g0-harold' },
    { id: 'ps-hale0', personAId: 'g0-agnes', personBId: 'g0-walter' },
    { id: 'ps-eleanor-frank', personAId: 'g1-eleanor', personBId: 'g1-frank' },
    // Robert: multiple partnerships (first partner unknown / not recorded as person)
    { id: 'ps-robert-susan', personAId: 'g1-robert', personBId: 'g1-susan', note: 'Second partnership' },
    { id: 'ps-diana-miguel', personAId: 'g1-diana', personBId: 'g1-miguel' },
    { id: 'ps-james-priya', personAId: 'g2-james-a', personBId: 'g2-priya' },
    { id: 'ps-lena-kevin', personAId: 'g2-lena', personBId: 'g2-kevin', note: 'Later partnership' },
    { id: 'ps-brooks', personAId: 'g2-adoptive-dad', personBId: 'g2-adoptive-mom' },
    { id: 'ps-carlos-sofia', personAId: 'g2-carlos', personBId: 'g2-sofia' },
    // Disconnected
    { id: 'ps-ash0', personAId: 'x0-irene', personBId: 'x0-victor' },
    { id: 'ps-ash1', personAId: 'x1-paul', personBId: 'x1-rita' },
  ],

  parentChildren: [
    // Gen0 → Gen1 (Willow)
    { id: 'pc1', parentId: 'g0-margaret', childId: 'g1-eleanor', kind: 'biological' },
    { id: 'pc2', parentId: 'g0-harold', childId: 'g1-eleanor', kind: 'biological' },
    { id: 'pc3', parentId: 'g0-margaret', childId: 'g1-robert', kind: 'biological' },
    { id: 'pc4', parentId: 'g0-harold', childId: 'g1-robert', kind: 'biological' },
    { id: 'pc5', parentId: 'g0-margaret', childId: 'g1-diana', kind: 'biological' },
    { id: 'pc6', parentId: 'g0-harold', childId: 'g1-diana', kind: 'biological' },

    // Gen0 → Gen1 (Hale) — Frank & Margaret Hale (siblings; Margaret name repeated with Willow matriarch)
    { id: 'pc-h1', parentId: 'g0-agnes', childId: 'g1-frank', kind: 'biological' },
    { id: 'pc-h2', parentId: 'g0-walter', childId: 'g1-frank', kind: 'biological' },
    { id: 'pc-h3', parentId: 'g0-agnes', childId: 'g1-margaret-hale', kind: 'biological' },
    { id: 'pc-h4', parentId: 'g0-walter', childId: 'g1-margaret-hale', kind: 'biological' },

    // Eleanor + Frank → James A/B
    { id: 'pc7', parentId: 'g1-eleanor', childId: 'g2-james-a', kind: 'biological' },
    { id: 'pc8', parentId: 'g1-frank', childId: 'g2-james-a', kind: 'biological' },
    { id: 'pc9', parentId: 'g1-eleanor', childId: 'g2-james-b', kind: 'biological' },
    { id: 'pc10', parentId: 'g1-frank', childId: 'g2-james-b', kind: 'biological' },

    // Robert → Lena (unknown other parent); Robert + Susan → Noah (half-siblings)
    { id: 'pc11', parentId: 'g1-robert', childId: 'g2-lena', kind: 'biological' },
    { id: 'pc12', parentId: 'g1-robert', childId: 'g2-noah', kind: 'biological' },
    { id: 'pc13', parentId: 'g1-susan', childId: 'g2-noah', kind: 'biological' },

    // Diana + Miguel → Amelia, Carlos
    { id: 'pc14', parentId: 'g1-diana', childId: 'g2-amelia', kind: 'biological' },
    { id: 'pc15', parentId: 'g1-miguel', childId: 'g2-amelia', kind: 'biological' },
    { id: 'pc16', parentId: 'g1-diana', childId: 'g2-carlos', kind: 'biological' },
    { id: 'pc17', parentId: 'g1-miguel', childId: 'g2-carlos', kind: 'biological' },

    // James A + Priya → Ava, Ethan
    { id: 'pc18', parentId: 'g2-james-a', childId: 'g3-ava', kind: 'biological' },
    { id: 'pc19', parentId: 'g2-priya', childId: 'g3-ava', kind: 'biological' },
    { id: 'pc20', parentId: 'g2-james-a', childId: 'g3-ethan', kind: 'biological' },
    { id: 'pc21', parentId: 'g2-priya', childId: 'g3-ethan', kind: 'biological' },

    // James B → Ruby (unknown mother)
    { id: 'pc22', parentId: 'g2-james-b', childId: 'g3-ruby', kind: 'biological' },

    // Noah → Leo
    { id: 'pc23', parentId: 'g2-noah', childId: 'g3-leo', kind: 'biological' },

    // Carlos + Sofia → Isla, Owen
    { id: 'pc24', parentId: 'g2-carlos', childId: 'g3-isla', kind: 'biological' },
    { id: 'pc25', parentId: 'g2-sofia', childId: 'g3-isla', kind: 'biological' },
    { id: 'pc26', parentId: 'g2-carlos', childId: 'g3-owen', kind: 'biological' },
    { id: 'pc27', parentId: 'g2-sofia', childId: 'g3-owen', kind: 'biological' },

    // Adoptive: Maya biological child of Lena; adoptive child of Brooks
    { id: 'pc28', parentId: 'g2-lena', childId: 'g2-maya', kind: 'biological' },
    { id: 'pc29', parentId: 'g2-adoptive-dad', childId: 'g2-maya', kind: 'adoptive' },
    { id: 'pc30', parentId: 'g2-adoptive-mom', childId: 'g2-maya', kind: 'adoptive' },
    { id: 'pc31', parentId: 'g2-maya', childId: 'g3-nina', kind: 'biological' },

    // Disconnected Ash branch
    { id: 'pcx1', parentId: 'x0-irene', childId: 'x1-claire', kind: 'biological' },
    { id: 'pcx2', parentId: 'x0-victor', childId: 'x1-claire', kind: 'biological' },
    { id: 'pcx3', parentId: 'x0-irene', childId: 'x1-paul', kind: 'biological' },
    { id: 'pcx4', parentId: 'x0-victor', childId: 'x1-paul', kind: 'biological' },
    { id: 'pcx5', parentId: 'x1-paul', childId: 'x2-sam', kind: 'biological' },
    { id: 'pcx6', parentId: 'x1-rita', childId: 'x2-sam', kind: 'biological' },
    { id: 'pcx7', parentId: 'x1-paul', childId: 'x2-jordan', kind: 'biological' },
    { id: 'pcx8', parentId: 'x1-rita', childId: 'x2-jordan', kind: 'biological' },
  ],
}

function p(
  id: string,
  firstName: string,
  lastName: string,
  gender: Person['gender'],
  birthYear: number | null,
  deathYear: number | null,
  biography: string,
  aliases: string[] = [],
): Person {
  return { id, firstName, lastName, gender, birthYear, deathYear, biography, aliases }
}

export const DEFAULT_FOCUS_PERSON_ID = 'g2-james-a'

export function getPerson(graph: FamilyGraph, id: string): Person | undefined {
  return graph.people.find((person) => person.id === id)
}

export function displayName(person: Person): string {
  return `${person.firstName} ${person.lastName}`.trim()
}
