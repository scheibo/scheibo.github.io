// Based on the MIT licensed matklad/matklad.github.io:
// https://github.com/matklad/matklad.github.io/blob/master/LICENSE-MIT

require('source-map-support').install();

import * as path from 'path';

import favicons from 'favicons';
import * as site from 'site';

const fs = site.fs;

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const SRC = path.join(ROOT, 'src');

const renderer = new site.page.Renderer({
  public: PUBLIC,
  analytics: 'G-TODO',
  description: 'Kirk Scheibelhut\'s personal blog',
  url: 'https://blog.scheibo.com',
  stylesheet: path.join(SRC, 'index.css'),
  // highlight: true,
});

const build = async (rebuild?: boolean) => {
  const now = new Date();

  fs.mkdir(path.join(PUBLIC));

  const actual = fs.list(PUBLIC);
  const expected = new Set<string>(['index.html', 'feed.xml', 'sitemap.txt', 'robots.txt']);
  if (!rebuild) {
    const icons = await favicons(path.join(SRC, 'assets', 'favicon.svg'), {path: PUBLIC});
    for (const icon of icons.images) {
      if (/(yandex|apple)/.test(icon.name)) continue;
      fs.write(path.join(PUBLIC, icon.name), icon.contents);
      expected.add(icon.name);
    }
  }

  for (const file of fs.list(path.join(SRC, 'assets'))) {
    expected.add(file);
    const src = path.join(SRC, 'assets', file);
    fs.copy(src, path.join(PUBLIC, file));
  }

  const canonical = (s: string) => s.replace(
    '<link rel="canonical" href="https://blog.scheibo.com',
    `<link rel="alternate" type="application/rss+xml" title="Posts" href="https://blog.scheibo.com/feed.xml">
    <link rel="canonical" href="https://blog.scheibo.com`
  );

  const entries: site.feed.Entry[] = [];
  const published: {[slug: string]: {date: string; updated?: string}} = {
    // 'why-zig': {date: '2024-03-25'},
  };

  const content: string[] = [process.env.NODE_ENV === 'development' ? `<nav class="hide">
  <ul>
    <li>
      <input type="radio" value="published" name="radio" id="published" checked="checked" />
      <label for="published">Published</label>
    </li>
    —
    <li>
      <input type="radio" value="all" name="radio" id="all" />
      <label for="all">All</label>
    </li>
    —
    <li>
      <input type="radio" value="unpublished" name="radio" id="unpublished" />
      <label for="unpublished">Unpublished</label>
    </li>
  </ul>
 </nav><ul>` : '<ul>'];

  for (const file of fs.list(path.join(SRC, 'posts')).sort((a: string, b: string) => {
    const pa = published[a.slice(0, -3)];
    const pb = published[b.slice(0, -3)];
    // Published > Date > Slug
    if (pa && !pb) return 1;
    if (pb && !pa) return -1;
    if (pa && pb) return +new Date(pb.date) - +new Date(pa.date);
    return a.localeCompare(b);
  })) {
    const slug = file.slice(0, -3);

    let date, time;
    if (published[slug]) {
      date = published[slug].date;
      time = `<time>${date}</time>`;
    } else {
      if (process.env.NODE_ENV !== 'development') continue;
      date = '0000-00-00';
      time = `<em><time>${date}</time></em>`;
    }

    expected.add(slug);

    const post: {title?: string; summary?: string} = {};
    const rendered = site.html.render(fs.read(path.join(SRC, 'posts', file)), {save: post});

    const title = site.html.render(post.title!).slice(3, -5);

    content.push(`<li class="post${published[slug] ? '" data-published="true"' : ' hide"'}>
      ${time} <a href="${slug}" class="subtle">${title}</a>
    </li>`);

    entries.push({
      ...published[slug],
      title,
      date,
      author: 'Kirk Scheibelhut',
      summary: post.summary ?? '',
      content: rendered,
      url: `https://blog.scheibo.com/${slug}/`,
    });

    const style = {}[slug] || '';
    const edit = published[slug]?.updated
      ? ` <span class="updated">(updated <time>${published[slug]?.updated}</time>)</span>` : '';
    renderer.create(slug, {
      id: 'post',
      path: `/${slug}/`,
      title: `${title}`,
      header: `<a href="/" class="subtle">${time}${edit}</a><h1>${title}</h1>`,
      content: rendered,
      style,
    }, canonical);
  }
  content.push('</ul>');

  fs.write(path.join(PUBLIC, 'index.html'), renderer.render({
    path: '',
    title: 'Posts',
    style: `
    ul {
      margin-top: 1em;
      padding: 0;
    }
    li {
      margin-bottom: 1rem;
      line-height: 1.15;
      list-style: none;
    }
    li > a {
      display: block;
      font-weight: bold;
      font-size: 1.5em;
    }` + (process.env.NODE_ENV === 'development' ? `
    nav > ul, .column > ul {
      margin-top: 0;
      padding: 0;
      list-style: none;
    }
    nav { text-align: center; }
    nav li { display: inline-block; }
    nav label { cursor: pointer; }
    nav input:checked + label { font-weight: bold; }
    nav input {
      position: absolute;
      width: 1px;
      height: 1px;
      white-space: nowrap;
      clip: rect(0 0 0 0);
      clip-path: inset(100%);
    }` : ''),
    content: content.join(''),
    script: process.env.NODE_ENV === 'development'
      ? `document.addEventListener('DOMContentLoaded', () => {
        document.getElementsByTagName('nav')[0].classList.remove('hide');
        const posts = document.getElementsByClassName('post');
        const radios = document.querySelectorAll('input[name="radio"]');

        for (let i = 0; i < radios.length; i++) {
          radios[i].addEventListener('click', () => {
            for (let j = 0; j < posts.length; j++) {
              if (radios[i].id === 'all') {
                posts[j].classList.remove('hide');
              } else {
                const hide = radios[i].id === 'published'
                  ? !posts[j].dataset.published
                  : posts[j].dataset.published;
                if (hide) {
                  posts[j].classList.add('hide');
                } else {
                  posts[j].classList.remove('hide');
                }
              }
            }
          });
        }
      });` : undefined,
  }, canonical));

  site.feed.render(PUBLIC, {
    url: 'https://blog.scheibo.com/',
    title: 'blog.scheibo.com',
    subtitle: 'Posts',
    author: 'Kirk Scheibelhut',
    updated: now.toISOString(),
    entries,
  });

  if (!rebuild) {
    for (const file of actual) {
      const full = path.join(PUBLIC, file);
      if (!expected.has(file) && !renderer.retain(full, now)) {
        fs.remove(full);
      }
    }
  }
};

if (require.main === module) {
  (async () => {
    await build(process.argv[2] === '--rebuild');
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
