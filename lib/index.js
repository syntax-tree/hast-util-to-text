/**
 * @import {Comment, Element, Nodes, Parents, Text} from 'hast'
 */

/**
 * @typedef {BreakForce | BreakNumber | BreakValue | undefined} BreakAfter
 *   Any value for a break after.
 */

/**
 * @typedef {BreakNumber | BreakValue | undefined} BreakBefore
 *   Any value for a break before.
 */

/**
 * @typedef {'\n'} BreakForce
 *   Forced break.
 */

/**
 * @typedef {0 | 1 | 2} BreakNumber
 *   Specific break:
 *
 *   *   `0` — space
 *   *   `1` — line ending
 *   *   `2` — blank line
 */

/**
 * @typedef {boolean} BreakValue
 *   Whether there was a break.
 */

/**
 * @typedef CollectionInfo
 *   Info on current collection.
 * @property {BreakAfter} breakAfter
 *   Whether there was a break after.
 * @property {BreakBefore} breakBefore
 *   Whether there was a break before.
 * @property {boolean | undefined} [rowAfter]
 *   Whether a row comes later in the nearest table, after the current node or
 *   after the row group it is in.
 * @property {Whitespace} whitespace
 *   Current whitespace setting.
 */

/**
 * @typedef Options
 *   Configuration.
 * @property {Whitespace | null | undefined} [whitespace='normal']
 *   Initial CSS whitespace setting to use (default: `'normal'`).
 */

/**
 * @typedef {'normal' | 'nowrap' | 'pre' | 'pre-wrap'} Whitespace
 *   Valid and useful whitespace values (from CSS).
 */

const searchLineFeeds = /\n/g
const searchTabOrSpaces = /[\t ]+/g
const whitespaceOnly = /^[\t\n\f\r ]+$/

const tablePartNames = new Set([
  'caption',
  'col',
  'colgroup',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr'
])

// Note that we don’t need to include void elements here as they don’t have text.
// See: <https://github.com/wooorm/html-void-elements>
const notRenderedNames = new Set([
  // List from: <https://html.spec.whatwg.org/multipage/rendering.html#hidden-elements>
  'datalist',
  'head',
  'noembed',
  'noframes',
  'noscript', // Act as if we support scripting.
  'rp',
  'script',
  'style',
  'template',
  'title'
])

// See: <https://html.spec.whatwg.org/multipage/rendering.html#the-css-user-agent-style-sheet-and-presentational-hints>
const blockOrCaptionNames = new Set([
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
  'form', // Flow content
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
  'li', // Lists (as `display: list-item`)
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
 * Get the plain-text value of a node.
 *
 * ###### Algorithm
 *
 * *   if `tree` is a comment, returns its `value`
 * *   if `tree` is a text, applies normal whitespace collapsing to its
 *     `value`, as defined by the CSS Text spec
 * *   if `tree` is a root or element, applies an algorithm similar to the
 *     `innerText` getter as defined by HTML
 *
 * ###### Notes
 *
 * > 👉 **Note**: the algorithm acts as if `tree` is being rendered, and as if
 * > we’re a CSS-supporting user agent, with scripting enabled.
 *
 * *   if `tree` is an element that is not displayed (such as a `head`), we’ll
 *     still use the `innerText` algorithm instead of switching to `textContent`
 * *   if descendants of `tree` are elements that are not displayed, they are
 *     ignored
 * *   CSS is not considered, except for the default user agent style sheet
 * *   a line feed is collapsed instead of ignored in cases where Fullwidth, Wide,
 *     or Halfwidth East Asian Width characters are used, the same goes for a case
 *     with Chinese, Japanese, or Yi writing systems
 * *   replaced elements (such as `audio`) are treated like non-replaced elements
 *
 * @param {Nodes} tree
 *   Tree to turn into text.
 * @param {Readonly<Options> | null | undefined} [options]
 *   Configuration (optional).
 * @returns {string}
 *   Serialized `tree`.
 */
export function toText(tree, options) {
  const options_ = options || {}
  const children = 'children' in tree ? tree.children : []
  let block = false
  let inTable = false

  if (tree.type === 'element') {
    block = blockOrCaptionNames.has(tree.tagName)
    inTable = tree.tagName === 'table' || rowGroup(tree)
  }

  const whitespace = inferWhitespace(tree, {
    breakAfter: false,
    breakBefore: false,
    whitespace: options_.whitespace || 'normal'
  })

  /** @type {Array<BreakNumber | string>} */
  const results = []

  // Treat `text` and `comment` as having normal white-space.
  // This deviates from the spec as in the DOM the node’s `.data` has to be
  // returned.
  // If you want that behavior use `hast-util-to-string`.
  // All other nodes are later handled as if they are `element`s (so the
  // algorithm also works on a `root`).
  // Nodes without children are treated as a void element, so `doctype` is thus
  // ignored.
  if (tree.type === 'text' || tree.type === 'comment') {
    append(
      results,
      collectText(tree, {
        breakAfter: true,
        breakBefore: true,
        whitespace
      })
    )
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
  let index = -1

  // 3.  For each child node node of this element:
  while (++index < children.length) {
    const next = children[index + 1]
    const breakAfter = next
      ? next.type === 'element' && next.tagName === 'br'
      : block
    const breakBefore = index ? undefined : block
    // 3.1. Let current be the list resulting in running the inner text
    //      collection steps with node.
    //      Each item in results will either be a JavaScript string or a
    //      positive integer (a required line break count).
    // 3.2. For each item item in current, append item to results.
    append(
      results,
      renderedTextCollection(
        children[index],
        index,
        /** @type {Parents} */ (tree),
        {
          breakAfter,
          breakBefore,
          rowAfter: inTable ? inferRowAfter(tree, index, undefined) : undefined,
          whitespace
        }
      )
    )
  }

  // 4.  Remove any items from results that are the empty string.
  // 5.  Remove any runs of consecutive required line break count items at the
  //     start or end of results.
  // 6.  Replace each remaining run of consecutive required line break count
  //     items with a string consisting of as many U+000A LINE FEED (LF)
  //     characters as the maximum of the values in the required line break
  //     count items.
  /** @type {Array<string>} */
  const result = []
  /** @type {number | undefined} */
  let count

  index = -1

  while (++index < results.length) {
    const value = results[index]

    if (typeof value === 'number') {
      if (count !== undefined && value > count) count = value
    } else if (value) {
      if (count !== undefined && count > -1) {
        result.push('\n'.repeat(count) || ' ')
      }

      count = -1
      result.push(value)
    }
  }

  // 7.  Return the concatenation of the string items in results.
  return result.join('')
}

/**
 * <https://html.spec.whatwg.org/multipage/dom.html#rendered-text-collection-steps>
 *
 * @param {Nodes} node
 *   Node.
 * @param {number} index
 *   Index of `node` in `parent`.
 * @param {Parents} parent
 *   Parent of `node`.
 * @param {CollectionInfo} info
 *   Info on current collection.
 * @returns {Array<BreakNumber | string>}
 *   Items.
 */
function renderedTextCollection(node, index, parent, info) {
  if (node.type === 'element') {
    return collectElement(node, index, parent, info)
  }

  if (node.type === 'text') {
    // White space in a table, row group, or row, between table parts, is not
    // rendered.
    //
    // See: <https://drafts.csswg.org/css-tables-3/#fixup-algorithm>
    if (
      whitespaceOnly.test(node.value) &&
      parent.type === 'element' &&
      (parent.tagName === 'table' ||
        parent.tagName === 'tr' ||
        rowGroup(parent))
    ) {
      const before = parent.children[index - 1]
      const after = parent.children[index + 1]

      if (
        (!before ||
          (before.type === 'element' && tablePartNames.has(before.tagName))) &&
        (!after ||
          (after.type === 'element' && tablePartNames.has(after.tagName)))
      ) {
        return []
      }
    }

    return info.whitespace === 'normal'
      ? collectText(node, info)
      : collectPreText(node)
  }

  return []
}

/**
 * Collect an element.
 *
 * @param {Element} node
 *   Element node.
 * @param {number} position
 *   Index of `node` in `parent`.
 * @param {Parents} parent
 *   Parent of `node`.
 * @param {CollectionInfo} info
 *   Info on current collection.
 * @returns {Array<BreakNumber | string>}
 *   Items.
 */
function collectElement(node, position, parent, info) {
  // First we infer the `white-space` property.
  const whitespace = inferWhitespace(node, info)
  const children = node.children || []
  const inTable = node.tagName === 'table' || rowGroup(node)
  let index = -1
  /** @type {Array<BreakNumber | string>} */
  const items = []

  // We’re ignoring point 3, and exiting without any content here, because we
  // deviated from the spec in `toText` at step 3.
  if (
    notRenderedNames.has(node.tagName) ||
    // Hidden attribute.
    node.properties?.hidden ||
    // From: <https://html.spec.whatwg.org/multipage/rendering.html#flow-content-3>
    (node.tagName === 'dialog' && !node.properties?.open)
  ) {
    return items
  }

  /** @type {BreakNumber | undefined} */
  let prefix
  /** @type {BreakForce | BreakNumber | undefined} */
  let suffix
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
  if (node.tagName === 'br') {
    suffix = '\n'
  }

  // 7.  If node’s computed value of `display` is `table-row`, and node’s CSS
  //     box is not the last `table-row` box of the nearest ancestor `table`
  //     box, then append a string containing a single U+000A LINE FEED (LF)
  //     character to items.
  //
  //     See: <https://html.spec.whatwg.org/multipage/rendering.html#tables-2>
  //     Note: needs further investigation as this does not account for implicit
  //     rows.
  else if (row(node) && (info.rowAfter || after(parent, position, row))) {
    suffix = '\n'
  }

  // 8.  If node is a `<p>` element, then append 2 (a required line break count)
  //     at the beginning and end of items.
  else if (node.tagName === 'p') {
    prefix = 2
    suffix = 2
  }

  // 9.  If node’s used value of `display` is block-level or `table-caption`,
  //     then append 1 (a required line break count) at the beginning and end of
  //     items.
  else if (blockOrCaptionNames.has(node.tagName)) {
    prefix = 1
    suffix = 1
  }

  // 1.  Let items be the result of running the inner text collection steps with
  //     each child node of node in tree order, and then concatenating the
  //     results to a single list.
  while (++index < children.length) {
    const next = children[index + 1]
    const breakAfter = next
      ? next.type === 'element' && next.tagName === 'br'
      : suffix
    const breakBefore = index ? undefined : prefix

    append(
      items,
      renderedTextCollection(children[index], index, node, {
        breakAfter,
        breakBefore,
        rowAfter: inTable
          ? inferRowAfter(node, index, info.rowAfter)
          : undefined,
        whitespace
      })
    )
  }

  // 6.  If node’s computed value of `display` is `table-cell`, and node’s CSS
  //     box is not the last `table-cell` box of its enclosing `table-row` box,
  //     then append a string containing a single U+0009 CHARACTER TABULATION
  //     (tab) character to items.
  //
  //     See: <https://html.spec.whatwg.org/multipage/rendering.html#tables-2>
  if (cell(node) && after(parent, position, cell)) {
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
 * @param {Comment | Text} node
 *   Text node.
 * @param {CollectionInfo} info
 *   Info on current collection.
 * @returns {Array<BreakNumber | string>}
 *   Result.
 */
function collectText(node, info) {
  const value = String(node.value)
  /** @type {Array<string>} */
  const lines = []
  /** @type {Array<BreakNumber | string>} */
  const result = []
  let start = 0

  while (start <= value.length) {
    searchLineFeeds.lastIndex = start

    const match = searchLineFeeds.exec(value)
    const end = match && 'index' in match ? match.index : value.length

    lines.push(
      // Any sequence of collapsible spaces and tabs immediately preceding or
      // following a segment break is removed.
      trimAndCollapseSpacesAndTabs(
        // […] ignoring bidi formatting characters (characters with the
        // Bidi_Control property [UAX9]: ALM, LTR, RTL, LRE-RLO, LRI-PDI) as if
        // they were not there.
        value
          .slice(start, end)
          .replace(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, ''),
        start === 0 ? info.breakBefore : true,
        end === value.length ? info.breakAfter : true
      )
    )

    start = end + 1
  }

  // Collapsible segment breaks are transformed for rendering according to the
  // segment break transformation rules.
  // So here we jump to 4.1.2 of [CSSTEXT]:
  // Any collapsible segment break immediately following another collapsible
  // segment break is removed
  let index = -1
  /** @type {BreakNumber | undefined} */
  let join

  while (++index < lines.length) {
    // *   If the character immediately before or immediately after the segment
    //     break is the zero-width space character (U+200B), then the break is
    //     removed, leaving behind the zero-width space.
    if (
      lines[index].charCodeAt(lines[index].length - 1) === 0x20_0b /* ZWSP */ ||
      (index < lines.length - 1 &&
        lines[index + 1].charCodeAt(0) === 0x20_0b) /* ZWSP */
    ) {
      result.push(lines[index])
      join = undefined
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
      if (typeof join === 'number') result.push(join)
      result.push(lines[index])
      join = 0
    } else if (index === 0 || index === lines.length - 1) {
      // If this line is empty, and it’s the first or last, add a space.
      // Note that this function is only called in normal whitespace, so we
      // don’t worry about `pre`.
      result.push(0)
    }
  }

  return result
}

/**
 * Collect a text node as “pre” whitespace.
 *
 * @param {Text} node
 *   Text node.
 * @returns {Array<BreakNumber | string>}
 *   Result.
 */
function collectPreText(node) {
  return [String(node.value)]
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
 *   Value to collapse.
 * @param {BreakBefore} breakBefore
 *   Whether there was a break before.
 * @param {BreakAfter} breakAfter
 *   Whether there was a break after.
 * @returns {string}
 *   Result.
 */
function trimAndCollapseSpacesAndTabs(value, breakBefore, breakAfter) {
  /** @type {Array<string>} */
  const result = []
  let start = 0
  /** @type {number | undefined} */
  let end

  while (start < value.length) {
    searchTabOrSpaces.lastIndex = start
    const match = searchTabOrSpaces.exec(value)
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
 * Figure out the whitespace of a node.
 *
 * We don’t support void elements here (so `nobr wbr` -> `normal` is ignored).
 *
 * @param {Nodes} node
 *   Node (typically `Element`).
 * @param {CollectionInfo} info
 *   Info on current collection.
 * @returns {Whitespace}
 *   Applied whitespace.
 */
function inferWhitespace(node, info) {
  if (node.type === 'element') {
    switch (node.tagName) {
      case 'listing':
      case 'plaintext':
      case 'xmp': {
        return 'pre'
      }

      case 'nobr': {
        return 'nowrap'
      }

      case 'pre': {
        return node.properties?.wrap ? 'pre-wrap' : 'pre'
      }

      case 'td':
      case 'th': {
        return node.properties?.noWrap ? 'nowrap' : info.whitespace
      }

      case 'textarea': {
        return 'pre-wrap'
      }

      default:
    }
  }

  return info.whitespace
}

/**
 * Check if a row comes later in a table.
 *
 * @param {Nodes} parent
 *   Table or row group.
 * @param {number} index
 *   Index of child in `parent`.
 * @param {boolean | undefined} rowAfter
 *   Whether a row comes after `parent`, if it is a row group.
 * @returns {boolean | undefined}
 *   Whether a row comes after the child in the nearest table.
 */
function inferRowAfter(parent, index, rowAfter) {
  return parent.type === 'element' && parent.tagName === 'table'
    ? after(parent, index, rowOrRowGroupWithRow)
    : rowAfter
}

/**
 * Check if an element after `index` in `parent` passes `test`.
 *
 * @param {Parents} parent
 *   Parent.
 * @param {number} index
 *   Index of a child in `parent`; elements after it are checked.
 * @param {(node: Element) => boolean} test
 *   Check.
 * @returns {boolean}
 *   Whether an element after `index` passes `test`.
 */
function after(parent, index, test) {
  while (++index < parent.children.length) {
    const child = parent.children[index]
    if (child.type === 'element' && test(child)) return true
  }

  return false
}

/**
 * Append items to a list; without `...spread` which overflows.
 *
 * @template Kind
 *   Item.
 * @param {Array<Kind>} list
 *   List to append to.
 * @param {Array<Kind>} items
 *   Items to append.
 * @returns {undefined}
 *   Nothing.
 */
function append(list, items) {
  let index = -1

  while (++index < items.length) {
    list.push(items[index])
  }
}

/**
 * Check if an element is a cell.
 *
 * @param {Element} node
 *   Element.
 * @returns {boolean}
 *   Whether `node` is a cell.
 */
function cell(node) {
  return node.tagName === 'td' || node.tagName === 'th'
}

/**
 * Check if an element is a row group; hot path so a basic regular function.
 *
 * @param {Element} node
 *   Element.
 * @returns {boolean}
 *   Whether `node` is a row group.
 */
function rowGroup(node) {
  return (
    node.tagName === 'tbody' ||
    node.tagName === 'tfoot' ||
    node.tagName === 'thead'
  )
}

/**
 * Check if an element is a row, or a row group with a row.
 *
 * @param {Element} node
 *   Element.
 * @returns {boolean}
 *   Whether `node` is a row or a row group with a row.
 */
function rowOrRowGroupWithRow(node) {
  if (row(node)) return true

  if (rowGroup(node)) {
    let index = -1

    while (++index < node.children.length) {
      const child = node.children[index]
      if (child.type === 'element' && row(child)) return true
    }
  }

  return false
}

/**
 * Check if an element is a row.
 *
 * @param {Element} node
 *   Element.
 * @returns {boolean}
 *   Whether `node` is a row.
 */
function row(node) {
  return node.tagName === 'tr'
}
