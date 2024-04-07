import assert from 'node:assert/strict'
import test from 'node:test'
import {h} from 'hastscript'
import {toText} from 'hast-util-to-text'

test('toText', async function (t) {
  await t.test('should expose the public api', async function () {
    assert.deepEqual(Object.keys(await import('hast-util-to-text')).sort(), [
      'toText'
    ])
  })

  await t.test('should default to `whitespace: normal`', async function () {
    assert.equal(toText(h('div', 'a\n  b\t\nc')), 'a b c')
  })

  await t.test('should support `whitespace: pre`', async function () {
    assert.equal(
      toText(h('div', 'a\n  b\t\nc'), {whitespace: 'pre'}),
      'a\n  b\t\nc'
    )
  })

  await t.test('should support `whitespace: pre-wrap`', async function () {
    assert.equal(
      toText(h('div', 'a\n  b\t\nc'), {whitespace: 'pre-wrap'}),
      'a\n  b\t\nc'
    )
  })

  await t.test('should support `whitespace: nowrap`', async function () {
    assert.equal(
      toText(h('div', 'a\n  b\t\nc'), {whitespace: 'nowrap'}),
      'a\n  b\t\nc'
    )
  })

  await t.test('should ignore a given doctype', async function () {
    assert.equal(toText({type: 'doctype'}), '')
  })

  await t.test('should ignore a nested doctype', async function () {
    assert.equal(toText(h('p', [{type: 'doctype'}])), '')
  })

  await t.test('should stringify a given comment', async function () {
    assert.equal(toText({type: 'comment', value: 'Alpha'}), 'Alpha')
  })

  await t.test('should ignore a nested comment', async function () {
    assert.equal(toText(h('p', [{type: 'comment', value: 'Bravo'}])), '')
  })

  await t.test('should stringify a given text', async function () {
    assert.equal(toText({type: 'comment', value: 'Charlie'}), 'Charlie')
  })

  await t.test('should stringify an empty element', async function () {
    assert.equal(toText(h('p')), '')
  })

  await t.test(
    'should not fail on an element without `children` (#1)',
    async function () {
      assert.equal(
        toText(
          // @ts-expect-error: check how missing `children` is handled.
          {type: 'element', tagName: 'p'}
        ),
        ''
      )
    }
  )

  await t.test(
    'should not fail on an element without `children` (#2)',
    async function () {
      assert.equal(
        toText(
          // @ts-expect-error: check how missing `children` is handled.
          h('div', [{type: 'element', tagName: 'p'}])
        ),
        ''
      )
    }
  )

  await t.test(
    'should not fail on an element without `properties` (#1)',
    async function () {
      assert.equal(
        toText(
          // @ts-expect-error: check how missing `properties` is handled.
          h('div', [{type: 'element', tagName: 'dialog', children: []}])
        ),
        ''
      )
    }
  )

  await t.test(
    'should stringify an element with nested text',
    async function () {
      assert.equal(toText(h('p', 'Delta')), 'Delta')
    }
  )

  await t.test(
    'should stringify a root with nested elements and text',
    async function () {
      assert.equal(toText({type: 'root', children: [h('p', 'Echo')]}), 'Echo')
    }
  )

  await t.test('should add newlines between paragraphs', async function () {
    assert.equal(
      toText(h('div', [h('p', 'Foxtrot.'), h('p', 'Golf.')])),
      'Foxtrot.\n\nGolf.'
    )
  })

  await t.test(
    'should ignore stuff in hidden elements (#1)',
    async function () {
      assert.equal(toText(h('html', [h('head', [h('title', 'Hotel')])])), '')
    }
  )

  await t.test(
    'should ignore stuff in hidden elements (#2)',
    async function () {
      assert.equal(toText(h('head', [h('title', 'India')])), '')
    }
  )

  await t.test(
    'should ignore stuff in hidden elements (#3)',
    async function () {
      assert.equal(toText(h('title', 'India')), 'India')
    }
  )

  await t.test(
    'should ignore stuff in hidden elements (#4)',
    async function () {
      assert.equal(toText(h('p', {hidden: true}, 'Kilo')), 'Kilo')
    }
  )

  await t.test(
    'should ignore stuff in hidden elements (#5)',
    async function () {
      assert.equal(toText(h('div', h('p', {hidden: true}, 'Lima'))), '')
    }
  )

  await t.test('should add a line feed for a `<br>`', async function () {
    assert.equal(
      toText(h('p', ['Mike.', h('br'), 'November.'])),
      'Mike.\nNovember.'
    )
  })

  await t.test(
    'should add tabs between cells and line feeds between rows',
    async function () {
      assert.equal(
        toText(
          h('table', [
            h('tr', [h('th', 'Oscar'), h('th', 'Papa')]),
            h('tr', [h('td', 'Québec'), h('td', 'Romeo')])
          ])
        ),
        'Oscar\tPapa\nQuébec\tRomeo'
      )
    }
  )

  await t.test('should add line feeds around a caption', async function () {
    assert.equal(
      toText(
        h('table', [
          h('caption', 'Sierra'),
          h('tr', [h('td', 'Tango'), h('td', 'Uniform')])
        ])
      ),
      'Sierra\nTango\tUniform'
    )
  })

  await t.test('should add line feeds around blocks', async function () {
    assert.equal(
      toText(h('main', [h('article', 'Whiskey'), h('article', 'X-Ray')])),
      'Whiskey\nX-Ray'
    )
  })

  await t.test('should ignore closed dialogs', async function () {
    assert.equal(toText(h('div', h('dialog', {open: false}, 'Yankee'))), '')
  })

  await t.test('should support white-space around elements', async function () {
    assert.equal(
      toText(h('p', ['Zulu\t', h('span', 'zulu'), '  \t zulu.'])),
      'Zulu zulu zulu.'
    )
  })
})

test('normal white-space', async function (t) {
  await t.test('should collapse spaces in text', async function () {
    assert.equal(
      toText(h('p', 'Alpha   bravo  charlie.')),
      'Alpha bravo charlie.'
    )
  })

  await t.test('should collapse tabs in text', async function () {
    assert.equal(
      toText(h('p', 'Delta\t\techo\tfoxtrot.')),
      'Delta echo foxtrot.'
    )
  })

  await t.test(
    'should collapse mixed spaces and tabs in text',
    async function () {
      assert.equal(
        toText(h('p', 'Golf \t  \thotel\t  india.')),
        'Golf hotel india.'
      )
    }
  )

  await t.test('should drop initial spaces', async function () {
    assert.equal(toText(h('p', '  Juliett kilo.')), 'Juliett kilo.')
  })

  await t.test('should drop initial tabs', async function () {
    assert.equal(toText(h('p', '\t\tLima mike.')), 'Lima mike.')
  })

  await t.test('should drop initial mixed spaces and tabs', async function () {
    assert.equal(toText(h('p', '\t  \tNovember oscar.')), 'November oscar.')
  })

  await t.test('should drop final spaces', async function () {
    assert.equal(toText(h('p', 'Papa québec.  ')), 'Papa québec.')
  })

  await t.test('should drop final tabs', async function () {
    assert.equal(toText(h('p', 'Romeo sierra.\t\t')), 'Romeo sierra.')
  })

  await t.test('should drop final mixed spaces and tabs', async function () {
    assert.equal(toText(h('p', 'Tango uniform.\t  \t')), 'Tango uniform.')
  })

  await t.test('should not fail without spaces or tabs', async function () {
    assert.equal(toText(h('p', 'Whiskey.')), 'Whiskey.')
  })

  await t.test(
    'should ignore spaces and tabs around line feeds',
    async function () {
      assert.equal(
        toText(h('p', 'X-ray \n\t\tyankee  \t\n\tzulu.')),
        'X-ray yankee zulu.'
      )
    }
  )

  await t.test(
    'should ignore subsequent collapsible line feeds',
    async function () {
      assert.equal(
        toText(h('p', 'Alpha \n\t\n  \tbravo.\n \n \n')),
        'Alpha bravo.'
      )
    }
  )

  await t.test('should ignore a single line feed', async function () {
    assert.equal(toText(h('p', '\n')), '')
  })

  await t.test('should ignore a bidi control characters', async function () {
    assert.equal(toText(h('p', ' \u061C Alpha.\t\u200F ')), 'Alpha.')
  })

  await t.test(
    'should not collapse line feeds to a space if they’re surrounded by a zero width space',
    async function () {
      assert.equal(
        toText(h('p', '\u200B \n Alpha\u200B \n\n\u200Bbravo\n\u200Bcharlie.')),
        '\u200BAlpha​\u200Bbravo\u200Bcharlie.'
      )
    }
  )

  await t.test(
    'should support trim white-space before a `<br>` (#1)',
    async function () {
      assert.equal(toText(h('div', h('p', ['Delta.  ', h('br')]))), 'Delta.\n')
    }
  )

  await t.test(
    'should support trim white-space before a `<br>` (#2)',
    async function () {
      assert.equal(toText(h('p', ['Delta.  ', h('br')])), 'Delta.\n')
    }
  )
})

test('non-normal white-space', async function (t) {
  await t.test('should support a `pre` element', async function () {
    assert.equal(
      toText(h('pre', ['\tAlpha \n\tbravo', h('br'), 'charlie()'])),
      '\tAlpha \n\tbravo\ncharlie()'
    )
  })

  await t.test('should support `[wrap]` on a `pre` element', async function () {
    assert.equal(
      toText(
        h('pre', {wrap: true}, ['\tAlpha \n\tbravo', h('br'), 'charlie()'])
      ),
      '\tAlpha \n\tbravo\ncharlie()'
    )
  })

  await t.test('should support a `listing` element', async function () {
    assert.equal(
      toText(h('listing', '\tAlpha \n\tbravo.')),
      '\tAlpha \n\tbravo.'
    )
  })

  await t.test(
    'should support `[nowrap]` on a `td` element',
    async function () {
      assert.equal(
        toText(h('td', {noWrap: true}, '\tAlpha \n\tbravo.')),
        '\tAlpha \n\tbravo.'
      )
    }
  )

  await t.test('should support a `nobr` element', async function () {
    assert.equal(toText(h('nobr', '\tAlpha \n\tbravo.')), '\tAlpha \n\tbravo.')
  })

  await t.test('should support a `textarea` element', async function () {
    assert.equal(
      toText(h('textarea', '\tDelta \n\techo\t\n')),
      '\tDelta \n\techo\t\n'
    )
  })

  await t.test('should support `li` elements', async function () {
    assert.equal(
      toText(h('ul', [h('li', 'Foxtrot'), h('li', 'Golf')])),
      'Foxtrot\nGolf'
    )
  })
})

test('more whitespace', async function (t) {
  await t.test(
    'should support line endings around element breaks (1)',
    async function () {
      assert.equal(toText(h('p', ['A\n', h('span', 'b')])), 'A b')
    }
  )

  await t.test(
    'should support line endings around element breaks (2)',
    async function () {
      assert.equal(toText(h('p', ['A\nb', h('span', 'c')])), 'A bc')
    }
  )

  await t.test(
    'should support line endings around element breaks (3)',
    async function () {
      assert.equal(toText(h('p', ['A', h('span', '\nb')])), 'A b')
    }
  )

  await t.test(
    'should support line endings around element breaks (4)',
    async function () {
      assert.equal(toText(h('p', ['A\n', h('span', '\nb')])), 'A b')
    }
  )

  await t.test(
    'should support line endings around element breaks (5)',
    async function () {
      assert.equal(toText(h('p', [h('span', 'A\n'), h('span', 'b')])), 'A b')
    }
  )

  await t.test(
    'should support line endings around element breaks (6)',
    async function () {
      assert.equal(toText(h('p', [h('span', 'A'), h('span', '\nb')])), 'A b')
    }
  )

  await t.test(
    'should support line endings around element breaks (7)',
    async function () {
      assert.equal(toText(h('p', [h('span', 'A\n'), h('span', '\nb')])), 'A b')
    }
  )

  await t.test(
    'should support line endings around element breaks (8)',
    async function () {
      assert.equal(toText(h('p', [h('span', 'A\n'), 'b'])), 'A b')
    }
  )

  await t.test(
    'should support line endings around element breaks (9)',
    async function () {
      assert.equal(toText(h('p', [h('span', 'A'), '\nb'])), 'A b')
    }
  )

  await t.test(
    'should support line endings around element breaks (10)',
    async function () {
      assert.equal(toText(h('p', [h('span', 'A\n'), '\nb'])), 'A b')
    }
  )

  await t.test(
    'should support line endings around element breaks (11)',
    async function () {
      assert.equal(toText(h('div', [h('p', [h('span', 'A\n'), '\nb'])])), 'A b')
    }
  )

  await t.test(
    'should support line endings around element breaks (12)',
    async function () {
      assert.equal(toText(h('pre', ['A\n', h('span', 'b')])), 'A\nb')
    }
  )
})
