/**
 * @typedef {import('hast-util-is-element').TestFunctionAnything} TestFunctionAnything
 * @typedef {import('hast').Parent['children'][number]} HastChild
 * @typedef {import('hast').Text} HastText
 * @typedef {import('hast').Comment} HastComment
 * @typedef {import('hast').Root} HastRoot
 * @typedef {import('hast').Element} HastElement
 * @typedef {import('hast').Properties} HastProperties
 * @typedef {HastChild|HastRoot} HastNode
 * @typedef {HastRoot|HastElement} HastParent
 *
 * @typedef {'normal'|'pre'|'nowrap'|'pre-wrap'} Whitespace
 * @typedef {boolean} BreakValue
 * @typedef {1|2} BreakNumber
 * @typedef {'\n'} BreakForce
 * @typedef {BreakValue|BreakNumber} BreakBefore
 * @typedef {BreakValue|BreakNumber|BreakForce} BreakAfter
 *
 * @typedef CollectionOptions
 * @property {Whitespace} whitespace
 * @property {BreakBefore} breakBefore
 * @property {BreakAfter} breakAfter
 */

import repeat from 'repeat-string'
import {convertElement} from 'hast-util-is-element'
import {findAfter} from 'unist-util-find-after'

var searchLineFeeds = /\n/g
var searchTabOrSpaces = /[\t ]+/g

var br = convertElement('br')
var p = convertElement('p')
var cell = convertElement(['th', 'td'])
var row = convertElement('tr')

// Note that we don’t need to include void elements here as they don’t have text.
// See: <https://github.com/wooorm/html-void-elements>
var notRendered = convertElement([
  // List from: <https://html.spec.whatwg.org/#hidden-elements>
  'datalist',
  'head',
  'noembed',
  'noframes',
  'noscript', // Act as if we support scripting.
  'rp',
  'script',
  'style',
  'template',
  'title',
  // Hidden attribute.
  hidden,
  // From: <https://html.spec.whatwg.org/#flow-content-3>
  closedDialog
])

// See: <https://html.spec.whatwg.org/#the-css-user-agent-style-sheet-and-presentational-hints>
var blockOrCaption = convertElement([
  'address', // Flow content
  'article', // Sections and headings
  'aside', // Sections and headings
  'blockquote', // Flow content
  'body', // Page
  'caption', // `table-caption`
  'center', // Flow content (legacy)
  'dd', // Lists
  'dialog', // Flow content
  'dir', // Lists (legacy)
  'dl', // Lists
  'dt', // Lists
  'div', // Flow content
  'figure', // Flow content
  'figcaption', // Flow content
  'footer', // Flow content
  'form,', // Flow content
  'h1', // Sections and headings
  'h2', // Sections and headings
  'h3', // Sections and headings
  'h4', // Sections and headings
  'h5', // Sections and headings
  'h6', // Sections and headings
  'header', // Flow content
  'hgroup', // Sections and headings
  'hr', // Flow content
  'html', // Page
  'legend', // Flow content
  'listing', // Flow content (legacy)
  'main', // Flow content
  'menu', // Lists
  'nav', // Sections and headings
  'ol', // Lists
  'p', // Flow content
  'plaintext', // Flow content (legacy)
  'pre', // Flow content
  'section', // Sections and headings
  'ul', // Lists
  'xmp' // Flow content (legacy)
])

/**
 * Implementation of the `innerText` getter:
 * <https://html.spec.whatwg.org/#the-innertext-idl-attribute>
 * Note that we act as if `node` is being rendered, and as if we’re a
 * CSS-supporting user agent.
 *
 * @param {HastNode} node
 * @returns {string}
 */
export function toText(node) {
  /** @type {Array.<HastChild>} */
  // @ts-ignore looks like a parent.
  var children = node.children || []
  var block = blockOrCaption(node)
  var whitespace = inferWhitespace(node, {
    whitespace: 'normal',
    breakBefore: false,
    breakAfter: false
  })
  var index = -1
  /** @type {Array.<string|BreakNumber>} */
  var results
  /** @type {Array.<string>} */
  var result
  /** @type {string|BreakNumber} */
  var value
  /** @type {number} */
  var count

  // Treat `text` and `comment` as having normal white-space.
  // This deviates from the spec as in the DOM the node’s `.data` has to be
  // returned.
  // If you want that behavior use `hast-util-to-string`.
  // All other nodes are later handled as if they are `element`s (so the
  // algorithm also works on a `root`).
  // Nodes without children are treated as a void element, so `doctype` is thus
  // ignored.
  if (node.type === 'text' || node.type === 'comment') {
    return collectText(node, {whitespace, breakBefore: true, breakAfter: true})
  }

  // 1.  If this element is not being rendered, or if the user agent is a
  //     non-CSS user agent, then return the same value as the textContent IDL
  //     attribute on this element.
  //
  //     Note: we’re not supporting stylesheets so we’re acting as if the node
  //     is rendered.
  //
  //     If you want that behavior use `hast-util-to-string`.
  //     Important: we’ll have to account for this later though.

  // 2.  Let results be a new empty list.
  results = []

  // 3.  For each child node node of this element:
  while (++index < children.length) {
    // 3.1. Let current be the list resulting in running the inner text
    //      collection steps with node.
    //      Each item in results will either be a JavaScript string or a
    //      positive integer (a required line break count).
    // 3.2. For each item item in current, append item to results.
    results = results.concat(
      // @ts-ignore Looks like a parent.
      innerTextCollection(children[index], node, {
        whitespace,
        breakBefore: index ? null : block,
        breakAfter:
          index < children.length - 1 ? br(children[index + 1]) : block
      })
    )
  }

  // 4.  Remove any items from results that are the empty string.
  // 5.  Remove any runs of consecutive required line break count items at the
  //     start or end of results.
  // 6.  Replace each remaining run of consecutive required line break count
  //     items with a string consisting of as many U+000A LINE FEED (LF)
  //     characters as the maximum of the values in the required line break
  //     count items.
  index = -1
  result = []

  while (++index < results.length) {
    value = results[index]

    if (typeof value === 'number') {
      if (count !== undefined && value > count) count = value
    } else if (value) {
      if (count) result.push(repeat('\n', count))
      count = 0
      result.push(value)
    }
  }

  // 7.  Return the concatenation of the string items in results.
  return result.join('')
}

/**
 * <https://html.spec.whatwg.org/#inner-text-collection-steps>
 *
 * @param {HastNode} node
 * @param {HastParent} parent
 * @param {CollectionOptions} options
 * @returns {Array.<string|BreakNumber>}
 */
function innerTextCollection(node, parent, options) {
  if (node.type === 'element') {
    return collectElement(node, parent, options)
  }

  if (node.type === 'text') {
    return [
      options.whitespace === 'normal'
        ? collectText(node, options)
        : collectPreText(node)
    ]
  }

  return []
}

/**
 * Collect an element.
 *
 * @param {HastElement} node
 * @param {HastParent} parent
 * @param {CollectionOptions} options
 */
function collectElement(node, parent, options) {
  // First we infer the `white-space` property.
  var whitespace = inferWhitespace(node, options)
  var children = node.children || []
  var index = -1
  /** @type {Array.<string|BreakNumber>} */
  var items = []
  /** @type {BreakNumber} */
  var prefix
  /** @type {BreakNumber|BreakForce} */
  var suffix

  // We’re ignoring point 3, and exiting without any content here, because we
  // deviated from the spec in `toText` at step 3.
  if (notRendered(node)) {
    return items
  }

  // Note: we first detect if there is going to be a break before or after the
  // contents, as that changes the white-space handling.

  // 2.  If node’s computed value of `visibility` is not `visible`, then return
  //     items.
  //
  //     Note: Ignored, as everything is visible by default user agent styles.

  // 3.  If node is not being rendered, then return items. [...]
  //
  //     Note: We already did this above.

  // See `collectText` for step 4.

  // 5.  If node is a `<br>` element, then append a string containing a single
  //     U+000A LINE FEED (LF) character to items.
  if (br(node)) {
    suffix = '\n'
  }

  // 7.  If node’s computed value of `display` is `table-row`, and node’s CSS
  //     box is not the last `table-row` box of the nearest ancestor `table`
  //     box, then append a string containing a single U+000A LINE FEED (LF)
  //     character to items.
  //
  //     See: <https://html.spec.whatwg.org/#tables-2>
  //     Note: needs further investigation as this does not account for implicit
  //     rows.
  else if (row(node) && findAfter(parent, node, row)) {
    suffix = '\n'
  }

  // 8.  If node is a `<p>` element, then append 2 (a required line break count)
  //     at the beginning and end of items.
  else if (p(node)) {
    prefix = 2
    suffix = 2
  }

  // 9.  If node’s used value of `display` is block-level or `table-caption`,
  //     then append 1 (a required line break count) at the beginning and end of
  //     items.
  else if (blockOrCaption(node)) {
    prefix = 1
    suffix = 1
  }

  // 1.  Let items be the result of running the inner text collection steps with
  //     each child node of node in tree order, and then concatenating the
  //     results to a single list.
  while (++index < children.length) {
    items = items.concat(
      innerTextCollection(children[index], node, {
        whitespace,
        breakBefore: index ? undefined : prefix,
        breakAfter:
          index < children.length - 1 ? br(children[index + 1]) : suffix
      })
    )
  }

  // 6.  If node’s computed value of `display` is `table-cell`, and node’s CSS
  //     box is not the last `table-cell` box of its enclosing `table-row` box,
  //     then append a string containing a single U+0009 CHARACTER TABULATION
  //     (tab) character to items.
  //
  //     See: <https://html.spec.whatwg.org/#tables-2>
  if (cell(node) && findAfter(parent, node, cell)) {
    items.push('\t')
  }

  // Add the pre- and suffix.
  if (prefix) items.unshift(prefix)
  if (suffix) items.push(suffix)

  return items
}

/**
 * 4.  If node is a Text node, then for each CSS text box produced by node,
 *     in content order, compute the text of the box after application of the
 *     CSS `white-space` processing rules and `text-transform` rules, set
 *     items to the list of the resulting strings, and return items.
 *     The CSS `white-space` processing rules are slightly modified:
 *     collapsible spaces at the end of lines are always collapsed, but they
 *     are only removed if the line is the last line of the block, or it ends
 *     with a br element.
 *     Soft hyphens should be preserved.
 *
 *     Note: See `collectText` and `collectPreText`.
 *     Note: we don’t deal with `text-transform`, no element has that by
 *     default.
 *
 * See: <https://drafts.csswg.org/css-text/#white-space-phase-1>
 *
 * @param {HastText|HastComment} node
 * @param {CollectionOptions} options
 * @returns {string}
 */
function collectText(node, options) {
  var value = String(node.value)
  /** @type {Array.<string>} */
  var lines = []
  /** @type {Array.<string>} */
  var result = []
  var start = 0
  var index = -1
  /** @type {RegExpMatchArray} */
  var match
  /** @type {number} */
  var end
  /** @type {string} */
  var join

  while (start < value.length) {
    searchLineFeeds.lastIndex = start
    match = searchLineFeeds.exec(value)
    end = match ? match.index : value.length

    lines.push(
      // Any sequence of collapsible spaces and tabs immediately preceding or
      // following a segment break is removed.
      trimAndCollapseSpacesAndTabs(
        // [...] ignoring bidi formatting characters (characters with the
        // Bidi_Control property [UAX9]: ALM, LTR, RTL, LRE-RLO, LRI-PDI) as if
        // they were not there.
        value
          .slice(start, end)
          .replace(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, ''),
        options.breakBefore,
        options.breakAfter
      )
    )

    start = end + 1
  }

  // Collapsible segment breaks are transformed for rendering according to the
  // segment break transformation rules.
  // So here we jump to 4.1.2 of [CSSTEXT]:
  // Any collapsible segment break immediately following another collapsible
  // segment break is removed
  while (++index < lines.length) {
    // *   If the character immediately before or immediately after the segment
    //     break is the zero-width space character (U+200B), then the break is
    //     removed, leaving behind the zero-width space.
    if (
      lines[index].charCodeAt(lines[index].length - 1) === 0x200b /* ZWSP */ ||
      (index < lines.length - 1 &&
        lines[index + 1].charCodeAt(0) === 0x200b) /* ZWSP */
    ) {
      result.push(lines[index])
      join = ''
    }

    // *   Otherwise, if the East Asian Width property [UAX11] of both the
    //     character before and after the segment break is Fullwidth, Wide, or
    //     Halfwidth (not Ambiguous), and neither side is Hangul, then the
    //     segment break is removed.
    //
    //     Note: ignored.
    // *   Otherwise, if the writing system of the segment break is Chinese,
    //     Japanese, or Yi, and the character before or after the segment break
    //     is punctuation or a symbol (Unicode general category P* or S*) and
    //     has an East Asian Width property of Ambiguous, and the character on
    //     the other side of the segment break is Fullwidth, Wide, or Halfwidth,
    //     and not Hangul, then the segment break is removed.
    //
    //     Note: ignored.

    // *   Otherwise, the segment break is converted to a space (U+0020).
    else if (lines[index]) {
      if (join) result.push(join)
      result.push(lines[index])
      join = ' '
    }
  }

  return result.join('')
}

/**
 * @param {HastText|HastComment} node
 * @returns {string}
 */
function collectPreText(node) {
  return String(node.value)
}

/**
 * 3.  Every collapsible tab is converted to a collapsible space (U+0020).
 * 4.  Any collapsible space immediately following another collapsible
 *     space—even one outside the boundary of the inline containing that
 *     space, provided both spaces are within the same inline formatting
 *     context—is collapsed to have zero advance width. (It is invisible,
 *     but retains its soft wrap opportunity, if any.)
 *
 * @param {string} value
 * @param {BreakBefore} breakBefore
 * @param {BreakAfter} breakAfter
 * @returns {string}
 */
function trimAndCollapseSpacesAndTabs(value, breakBefore, breakAfter) {
  /** @type {Array.<string>} */
  var result = []
  var start = 0
  /** @type {RegExpMatchArray} */
  var match
  /** @type {number} */
  var end

  while (start < value.length) {
    searchTabOrSpaces.lastIndex = start
    match = searchTabOrSpaces.exec(value)
    end = match ? match.index : value.length

    // If we’re not directly after a segment break, but there was white space,
    // add an empty value that will be turned into a space.
    if (!start && !end && match && !breakBefore) {
      result.push('')
    }

    if (start !== end) {
      result.push(value.slice(start, end))
    }

    start = match ? end + match[0].length : end
  }

  // If we reached the end, there was trailing white space, and there’s no
  // segment break after this node, add an empty value that will be turned
  // into a space.
  if (start !== end && !breakAfter) {
    result.push('')
  }

  return result.join(' ')
}

/**
 * We don’t support void elements here (so `nobr wbr` -> `normal` is ignored).
 *
 * @param {HastNode} node
 * @param {CollectionOptions} options
 * @returns {Whitespace}
 */
function inferWhitespace(node, options) {
  /** @type {HastProperties} */
  var props

  if (node.type === 'element') {
    props = node.properties || {}
    switch (node.tagName) {
      case 'listing':
      case 'plaintext':
      case 'xmp':
        return 'pre'
      case 'nobr':
        return 'nowrap'
      case 'pre':
        return props.wrap ? 'pre-wrap' : 'pre'
      case 'td':
      case 'th':
        return props.noWrap ? 'nowrap' : options.whitespace
      case 'textarea':
        return 'pre-wrap'
      default:
    }
  }

  return options.whitespace
}

/** @type {TestFunctionAnything} */
function hidden(node) {
  return Boolean((node.properties || {}).hidden)
}

/** @type {TestFunctionAnything} */
function closedDialog(node) {
  return node.tagName === 'dialog' && !(node.properties || {}).open
}
