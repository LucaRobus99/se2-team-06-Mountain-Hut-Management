import { createElement, useMemo } from 'react';

// Parse in an inert document and recreate only allowed elements, never attributes.
const allowed = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'ul', 'ol', 'li']);
const discard = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template']);
function renderNode(node, key) {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return null;
  const tag = node.localName;
  if (discard.has(tag)) return null;
  const children = Array.from(node.childNodes, renderNode);
  if (!allowed.has(tag)) return createElement('span', { key }, children);
  return tag === 'br' ? createElement(tag, { key }) : createElement(tag, { key }, children);
}
export default function MenuContent({ content }) {
  const nodes = useMemo(() => {
    const doc = new DOMParser().parseFromString(content || '', 'text/html');
    return Array.from(doc.body.childNodes, renderNode);
  }, [content]);
  return <div className="menu-rich-content">{nodes}</div>;
}
