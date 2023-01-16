import assert from 'node:assert/strict'
import test from 'node:test'
import {u} from 'unist-builder'
import {h} from 'hastscript'
import {toText} from './index.js'
import * as mod from './index.js'

test('toText', () => {
  assert.deepEqual(
    Object.keys(mod).sort(),
    ['toText'],
    'should expose the public api'
  )

  assert.equal(
    toText(h('div', 'a\n  b\t\nc')),
    'a b c',
    'should default to `whitespace: normal`'
  )

  assert.equal(
    toText(h('div', 'a\n  b\t\nc'), {whitespace: 'pre'}),
    'a\n  b\t\nc',
    'should support `whitespace: pre`'
  )

  assert.equal(
    toText(h('div', 'a\n  b\t\nc'), {whitespace: 'pre-wrap'}),
    'a\n  b\t\nc',
    'should support `whitespace: pre-wrap`'
  )

  assert.equal(
    toText(h('div', 'a\n  b\t\nc'), {whitespace: 'nowrap'}),
    'a\n  b\t\nc',
    'should support `whitespace: nowrap`'
  )

  assert.equal(
    toText(u('doctype', {name: 'html'})),
    '',
    'should ignore a given doctype'
  )

  assert.equal(
    toText(h('p', u('doctype', {name: 'html'}))),
    '',
    'should ignore a nested doctype'
  )

  assert.equal(
    toText(u('comment', 'Alpha')),
    'Alpha',
    'should stringify a given comment'
  )

  assert.equal(
    toText(h('p', u('comment', 'Bravo'))),
    '',
    'should ignore a nested comment'
  )

  assert.equal(
    toText(u('text', 'Charlie')),
    'Charlie',
    'should stringify a given text'
  )

  assert.equal(toText(h('p')), '', 'should stringify an empty element')

  assert.equal(
    // @ts-expect-error runtime.
    toText(u('element', {tagName: 'p'})),
    '',
    'should not fail on an element without `children` (#1)'
  )

  assert.equal(
    // @ts-expect-error runtime.
    toText(h('div', [u('element', {tagName: 'p'})])),
    '',
    'should not fail on an element without `children` (#2)'
  )

  assert.equal(
    // @ts-expect-error runtime.
    toText(h('div', [u('element', {tagName: 'dialog'})])),
    '',
    'should not fail on an element without `properties` (#1)'
  )

  assert.equal(
    toText(h('p', 'Delta')),
    'Delta',
    'should stringify an element with nested text'
  )

  assert.equal(
    toText(u('root', [h('p', 'Echo')])),
    'Echo',
    'should stringify a root with nested elements and text'
  )

  assert.equal(
    toText(h('div', [h('p', 'Foxtrot.'), h('p', 'Golf.')])),
    'Foxtrot.\n\nGolf.',
    'should add newlines between paragraphs'
  )

  assert.equal(
    toText(h('html', [h('head', [h('title', 'Hotel')])])),
    '',
    'should ignore stuff in hidden elements (#1)'
  )

  assert.equal(
    toText(h('head', [h('title', 'India')])),
    '',
    'should ignore stuff in hidden elements (#2)'
  )

  assert.equal(
    toText(h('title', 'India')),
    'India',
    'should ignore stuff in hidden elements (#3)'
  )

  assert.equal(
    toText(h('p', {hidden: true}, 'Kilo')),
    'Kilo',
    'should ignore stuff in hidden elements (#4)'
  )

  assert.equal(
    toText(h('div', h('p', {hidden: true}, 'Lima'))),
    '',
    'should ignore stuff in hidden elements (#5)'
  )

  assert.equal(
    toText(h('p', ['Mike.', h('br'), 'November.'])),
    'Mike.\nNovember.',
    'should add a line feed for a `<br>`'
  )

  assert.equal(
    toText(
      h('table', [
        h('tr', [h('th', 'Oscar'), h('th', 'Papa')]),
        h('tr', [h('td', 'Québec'), h('td', 'Romeo')])
      ])
    ),
    'Oscar\tPapa\nQuébec\tRomeo',
    'should add tabs between cells and line feeds between rows'
  )

  assert.equal(
    toText(
      h('table', [
        h('caption', 'Sierra'),
        h('tr', [h('td', 'Tango'), h('td', 'Uniform')])
      ])
    ),
    'Sierra\nTango\tUniform',
    'should add line feeds around a caption'
  )

  assert.equal(
    toText(h('main', [h('article', 'Whiskey'), h('article', 'X-Ray')])),
    'Whiskey\nX-Ray',
    'should add line feeds around blocks'
  )

  assert.equal(
    toText(h('div', h('dialog', {open: false}, 'Yankee'))),
    '',
    'should ignore closed dialogs'
  )

  assert.equal(
    toText(h('p', ['Zulu\t', h('span', 'zulu'), '  \t zulu.'])),
    'Zulu zulu zulu.',
    'should support white-space around elements'
  )
})

test('normal white-space', () => {
  assert.equal(
    toText(h('p', 'Alpha   bravo  charlie.')),
    'Alpha bravo charlie.',
    'should collapse spaces in text'
  )

  assert.equal(
    toText(h('p', 'Delta\t\techo\tfoxtrot.')),
    'Delta echo foxtrot.',
    'should collapse tabs in text'
  )

  assert.equal(
    toText(h('p', 'Golf \t  \thotel\t  india.')),
    'Golf hotel india.',
    'should collapse mixed spaces and tabs in text'
  )

  assert.equal(
    toText(h('p', '  Juliett kilo.')),
    'Juliett kilo.',
    'should drop initial spaces'
  )

  assert.equal(
    toText(h('p', '\t\tLima mike.')),
    'Lima mike.',
    'should drop initial tabs'
  )

  assert.equal(
    toText(h('p', '\t  \tNovember oscar.')),
    'November oscar.',
    'should drop initial mixed spaces and tabs'
  )

  assert.equal(
    toText(h('p', 'Papa québec.  ')),
    'Papa québec.',
    'should drop final spaces'
  )

  assert.equal(
    toText(h('p', 'Romeo sierra.\t\t')),
    'Romeo sierra.',
    'should drop final tabs'
  )

  assert.equal(
    toText(h('p', 'Tango uniform.\t  \t')),
    'Tango uniform.',
    'should drop final mixed spaces and tabs'
  )

  assert.equal(
    toText(h('p', 'Whiskey.')),
    'Whiskey.',
    'should not fail without spaces or tabs'
  )

  assert.equal(
    toText(h('p', 'X-ray \n\t\tyankee  \t\n\tzulu.')),
    'X-ray yankee zulu.',
    'should ignore spaces and tabs around line feeds'
  )

  assert.equal(
    toText(h('p', 'Alpha \n\t\n  \tbravo.\n \n \n')),
    'Alpha bravo.',
    'should ignore subsequent collapsible line feeds'
  )

  assert.equal(toText(h('p', '\n')), '', 'should ignore a single line feed')

  assert.equal(
    toText(h('p', ' \u061C Alpha.\t\u200F ')),
    'Alpha.',
    'should ignore a bidi control characters'
  )

  assert.equal(
    toText(h('p', '\u200B \n Alpha\u200B \n\n\u200Bbravo\n\u200Bcharlie.')),
    '\u200BAlpha​\u200Bbravo\u200Bcharlie.',
    'should not collapse line feeds to a space if they’re surrounded by a zero width space'
  )

  assert.equal(
    toText(h('div', h('p', ['Delta.  ', h('br')]))),
    'Delta.\n',
    'should support trim white-space before a `<br>` (#1)'
  )

  assert.equal(
    toText(h('p', ['Delta.  ', h('br')])),
    'Delta.\n',
    'should support trim white-space before a `<br>` (#2)'
  )
})

test('non-normal white-space', () => {
  assert.equal(
    toText(h('pre', ['\tAlpha \n\tbravo', h('br'), 'charlie()'])),
    '\tAlpha \n\tbravo\ncharlie()',
    'should support a `pre` element'
  )

  assert.equal(
    toText(h('pre', {wrap: true}, ['\tAlpha \n\tbravo', h('br'), 'charlie()'])),
    '\tAlpha \n\tbravo\ncharlie()',
    'should support `[wrap]` on a `pre` element'
  )

  assert.equal(
    toText(h('listing', '\tAlpha \n\tbravo.')),
    '\tAlpha \n\tbravo.',
    'should support a `listing` element'
  )

  assert.equal(
    toText(h('td', {noWrap: true}, '\tAlpha \n\tbravo.')),
    '\tAlpha \n\tbravo.',
    'should support `[nowrap]` on a `td` element'
  )

  assert.equal(
    toText(h('nobr', '\tAlpha \n\tbravo.')),
    '\tAlpha \n\tbravo.',
    'should support a `nobr` element'
  )

  assert.equal(
    toText(h('textarea', '\tDelta \n\techo\t\n')),
    '\tDelta \n\techo\t\n',
    'should support a `textarea` element'
  )
})

test('more whitespace', () => {
  assert.equal(
    toText(h('p', ['A\n', h('span', 'b')])),
    'A b',
    'should support line endings around element breaks (1)'
  )

  assert.equal(
    toText(h('p', ['A\nb', h('span', 'c')])),
    'A bc',
    'should support line endings around element breaks (2)'
  )

  assert.equal(
    toText(h('p', ['A', h('span', '\nb')])),
    'A b',
    'should support line endings around element breaks (3)'
  )

  assert.equal(
    toText(h('p', ['A\n', h('span', '\nb')])),
    'A b',
    'should support line endings around element breaks (4)'
  )

  assert.equal(
    toText(h('p', [h('span', 'A\n'), h('span', 'b')])),
    'A b',
    'should support line endings around element breaks (5)'
  )

  assert.equal(
    toText(h('p', [h('span', 'A'), h('span', '\nb')])),
    'A b',
    'should support line endings around element breaks (6)'
  )

  assert.equal(
    toText(h('p', [h('span', 'A\n'), h('span', '\nb')])),
    'A b',
    'should support line endings around element breaks (7)'
  )

  assert.equal(
    toText(h('p', [h('span', 'A\n'), 'b'])),
    'A b',
    'should support line endings around element breaks (8)'
  )

  assert.equal(
    toText(h('p', [h('span', 'A'), '\nb'])),
    'A b',
    'should support line endings around element breaks (9)'
  )

  assert.equal(
    toText(h('p', [h('span', 'A\n'), '\nb'])),
    'A b',
    'should support line endings around element breaks (10)'
  )

  assert.equal(
    toText(h('div', [h('p', [h('span', 'A\n'), '\nb'])])),
    'A b',
    'should support line endings around element breaks (11)'
  )

  assert.equal(
    toText(h('pre', ['A\n', h('span', 'b')])),
    'A\nb',
    'should support line endings around element breaks (12)'
  )
})
