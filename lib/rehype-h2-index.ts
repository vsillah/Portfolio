/**
 * Rehype plugin that:
 * - Adds data-h2-index (0, 1, 2, ...) to each h2 for "Back to top" visibility.
 * - Adds id (slug from heading text) to each h2 so TOC anchor links work.
 */
interface HastNode {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  value?: string
}

function getTextContent(node: HastNode): string {
  if (node.type === 'text' && node.value) return node.value
  if (!node.children) return ''
  return node.children.map(getTextContent).join('')
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s*&\s*/g, '--')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
}

export function rehypeH2Index() {
  return (tree: HastNode) => {
    let index = 0
    visit(tree, (node) => {
      if (node.type === 'element' && node.tagName === 'h2') {
        node.properties = node.properties ?? {}
        node.properties['dataH2Index'] = index
        const slug = slugify(getTextContent(node))
        if (slug) node.properties['id'] = slug
        index += 1
      }
    })
  }
}

function visit(node: HastNode, fn: (node: HastNode) => void) {
  fn(node)
  if (node.children) {
    for (const child of node.children) {
      visit(child, fn)
    }
  }
}
