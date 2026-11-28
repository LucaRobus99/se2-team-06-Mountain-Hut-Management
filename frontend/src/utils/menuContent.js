// A deliberately small text format: **bold**, *italic*, and indented lists.
// Escape all user text before adding the only supported HTML tags.
const escapeText = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(text) {
  return escapeText(text).replace(/\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g,
    (_, bold, italic) => bold !== undefined ? `<strong>${bold}</strong>` : `<em>${italic}</em>`);
}
export function menuToHtml(text) {
  const lines = text.split(/\r?\n/);
  const root = [];
  const stack = [];
  for (const line of lines) {
    // Editing-only notes must never reach the preview or persisted HTML.
    if (line.trimStart().startsWith('//')) continue;
    const match = /^( *)([-*]|\d+\.)\s+(.+)$/.exec(line);
    if (!match) {
      stack.length = 0;
      if (line.trim()) root.push({ text: line, paragraph: true });
      continue;
    }
    const depth = Math.floor(match[1].length / 2);
    const tag = /\d/.test(match[2]) ? 'ol' : 'ul';
    while (stack.length && stack.at(-1).depth > depth) stack.pop();
    let level = stack.at(-1);
    if (!level || level.depth !== depth || level.node.tag !== tag) {
      if (level?.depth === depth) stack.pop();
      level = stack.at(-1);
      const parent = level?.node.items.at(-1)?.children ?? root;
      const node = { tag, items: [] };
      parent.push(node);
      stack.push({ depth, node });
    }
    stack.at(-1).node.items.push({ text: match[3], children: [] });
  }
  function render(nodes) {
    return nodes.map(node => node.paragraph ? `<p>${inline(node.text)}</p>` :
      `<${node.tag}>${node.items.map(item => `<li>${inline(item.text)}${render(item.children)}</li>`).join('')}</${node.tag}>`).join('');
  }
  return render(root);
}
