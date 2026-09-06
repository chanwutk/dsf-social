import * as cheerio from 'cheerio';

const roles = new Set([
  'Collaborator',
  'Core Faculty',
  'Faculty',
  'GSR',
  'Postdoc',
  'Staff',
  'Visiting Student Researcher',
  'Affiliate Researcher',
  'Visiting Scholar',
]);

export function parseRoster(html: string, nameHeading: 'h4' | 'h5') {
  const $ = cheerio.load(html);
  let role = '';
  const entries: Array<{ name: string; role: string }> = [];
  $('h1, h2, h3, h4, h5').each((_index, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    const tag = element.tagName.toLowerCase();
    if (roles.has(text)) role = text;
    else if (tag === nameHeading && role && text) entries.push({ name: text, role });
    else if (Number(tag.slice(1)) <= Number(nameHeading.slice(1))) role = '';
  });
  const deduplicated = [...new Map(entries.map((entry) => [entry.name.toLowerCase(), entry])).values()];
  if (deduplicated.length < 10) throw new Error('page structure did not match (fewer than 10 people)');
  return deduplicated;
}

// EPIC renders person cards as paragraphs, rather than name headings.
export function parseEpicRoster(html: string) {
  const $ = cheerio.load(html);
  const entries: Array<{ name: string; role: string }> = [];
  for (const id of ['faculty', 'collaborators', 'postdocs', 'graduate-students', 'undergraduate-students']) {
    $(`h3#${id}`).nextUntil('h2, h3').each((_index, element) => {
      const name = $(element).find('p.font-bold').first().text().replace(/\s+/g, ' ').trim();
      const role = $(element).find('p.font-serif').first().text().trim();
      if (name && ['Faculty', 'Collaborator', 'Postdoc', 'PhD Student', 'Undergraduate'].includes(role)) {
        entries.push({ name, role });
      }
    });
  }
  const unique = [...new Map(entries.map((entry) => [entry.name.toLowerCase(), entry])).values()];
  if (unique.length < 10) throw new Error('EPIC page structure did not match (fewer than 10 people)');
  return unique;
}
