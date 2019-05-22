'use strict'

var test = require('tape')
var u = require('unist-builder')
var h = require('hastscript')
var toText = require('.')

test('hast-util-to-text', function(t) {
  t.equal(
    toText(u('doctype', {name: 'html'})),
    '',
    'should ignore a given doctype'
  )

  t.equal(
    toText(h('p', u('doctype', {name: 'html'}))),
    '',
    'should ignore a nested doctype'
  )

  t.equal(
    toText(u('comment', 'Alpha')),
    'Alpha',
    'should stringify a given comment'
  )

  t.equal(
    toText(h('p', u('comment', 'Bravo'))),
    '',
    'should ignore a nested comment'
  )

  t.equal(
    toText(u('text', 'Charlie')),
    'Charlie',
    'should stringify a given text'
  )

  t.equal(toText(h('p')), '', 'should stringify an empty element')

  t.equal(
    toText(u('element', {tagName: 'p'})),
    '',
    'should not fail on an element without `children` (#1)'
  )

  t.equal(
    toText(h('div', [u('element', {tagName: 'p'})])),
    '',
    'should not fail on an element without `children` (#2)'
  )

  t.equal(
    toText(h('p', 'Delta')),
    'Delta',
    'should stringify an element with nested text'
  )

  t.equal(
    toText(u('root', [h('p', 'Echo')])),
    'Echo',
    'should stringify a root with nested elements and text'
  )

  t.equal(
    toText(h('div', [h('p', 'Foxtrot.'), h('p', 'Golf.')])),
    'Foxtrot.\n\nGolf.',
    'should add newlines between paragraphs'
  )

  t.equal(
    toText(h('html', [h('head', [h('title', 'Hotel')])])),
    '',
    'should ignore stuff in hidden elements (#1)'
  )

  t.equal(
    toText(h('head', [h('title', 'India')])),
    '',
    'should ignore stuff in hidden elements (#2)'
  )

  t.equal(
    toText(h('title', 'India')),
    'India',
    'should ignore stuff in hidden elements (#3)'
  )

  t.equal(
    toText(h('p', {hidden: true}, 'Kilo')),
    'Kilo',
    'should ignore stuff in hidden elements (#4)'
  )

  t.equal(
    toText(h('div', h('p', {hidden: true}, 'Lima'))),
    '',
    'should ignore stuff in hidden elements (#5)'
  )

  t.equal(
    toText(h('p', ['Mike.', h('br'), 'November.'])),
    'Mike.\nNovember.',
    'should add a line feed for a `<br>`'
  )

  t.equal(
    toText(
      h('table', [
        h('tr', [h('th', 'Oscar'), h('th', 'Papa')]),
        h('tr', [h('td', 'Québec'), h('td', 'Romeo')])
      ])
    ),
    'Oscar\tPapa\nQuébec\tRomeo',
    'should add tabs between cells and line feeds between rows'
  )

  t.equal(
    toText(
      h('table', [
        h('caption', 'Sierra'),
        h('tr', [h('td', 'Tango'), h('td', 'Uniform')])
      ])
    ),
    'Sierra\nTango\tUniform',
    'should add line feeds around a caption'
  )

  t.equal(
    toText(h('main', [h('article', 'Whiskey'), h('article', 'X-Ray')])),
    'Whiskey\nX-Ray',
    'should add line feeds around blocks'
  )

  t.equal(
    toText(h('div', h('dialog', {open: false}, 'Yankee'))),
    '',
    'should ignore closed dialogs'
  )

  t.test('normal white-space', function(st) {
    st.equal(
      toText(h('p', 'Alpha   bravo  charlie.')),
      'Alpha bravo charlie.',
      'should collapse spaces in text'
    )

    st.equal(
      toText(h('p', 'Delta\t\techo\tfoxtrot.')),
      'Delta echo foxtrot.',
      'should collapse tabs in text'
    )

    st.equal(
      toText(h('p', 'Golf \t  \thotel\t  india.')),
      'Golf hotel india.',
      'should collapse mixed spaces and tabs in text'
    )

    st.equal(
      toText(h('p', '  Juliett kilo.')),
      'Juliett kilo.',
      'should drop initial spaces'
    )

    st.equal(
      toText(h('p', '\t\tLima mike.')),
      'Lima mike.',
      'should drop initial tabs'
    )

    st.equal(
      toText(h('p', '\t  \tNovember oscar.')),
      'November oscar.',
      'should drop initial mixed spaces and tabs'
    )

    st.equal(
      toText(h('p', 'Papa québec.  ')),
      'Papa québec.',
      'should drop final spaces'
    )

    st.equal(
      toText(h('p', 'Romeo sierra.\t\t')),
      'Romeo sierra.',
      'should drop final tabs'
    )

    st.equal(
      toText(h('p', 'Tango uniform.\t  \t')),
      'Tango uniform.',
      'should drop final mixed spaces and tabs'
    )

    st.equal(
      toText(h('p', 'Whiskey.')),
      'Whiskey.',
      'should not fail without spaces or tabs'
    )

    st.equal(
      toText(h('p', 'X-ray \n\t\tyankee  \t\n\tzulu.')),
      'X-ray yankee zulu.',
      'should ignore spaces and tabs around line feeds'
    )

    st.equal(
      toText(h('p', 'Alpha \n\t\n  \tbravo.\n \n \n')),
      'Alpha bravo.',
      'should ignore subsequent collapsible line feeds'
    )

    st.equal(toText(h('p', '\n')), '', 'should ignore a single line feed')

    st.equal(
      toText(h('p', ' \u061C Alpha.\t\u200F ')),
      'Alpha.',
      'should ignore a bidi control characters'
    )

    st.equal(
      toText(h('p', '\u200B \n Alpha\u200B \n\n\u200Bbravo\n\u200Bcharlie.')),
      '\u200BAlpha​\u200Bbravo\u200Bcharlie.',
      'should not collapse line feeds to a space if they’re surrounded by a zero width space'
    )

    st.end()
  })

  t.test('non-normal white-space', function(st) {
    st.equal(
      toText(h('pre', ['\tAlpha \n\tbravo', h('br'), 'charlie()'])),
      '\tAlpha \n\tbravo\ncharlie()',
      'should support a `pre` element'
    )

    st.equal(
      toText(h('textarea', '\tDelta \n\techo\t\n')),
      '\tDelta \n\techo\t\n',
      'should support a `textarea` element'
    )

    st.end()
  })

  t.end()
})
