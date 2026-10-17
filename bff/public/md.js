// 极简、安全的 Markdown 渲染：先整体转义 HTML，再处理代码块、行内代码、标题、列表、粗体、链接
(function () {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/\[([^\]\n]+)\]\((#\/[\w/-]+)\)/g, '<a href="$2">$1</a>');   // 站内链接，例如 #/recharge
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
    return s;
  }

  function render(src) {
    const text = esc(String(src || ''));
    const out = [];
    const blocks = text.split(/^```/m);
    blocks.forEach((part, idx) => {
      if (idx % 2 === 1) {
        const nl = part.indexOf('\n');
        const lang = nl > -1 ? part.slice(0, nl).trim() : '';
        const code = nl > -1 ? part.slice(nl + 1) : part;
        out.push(`<div class="codeblock"><div class="codebar"><span>${lang || 'code'}</span><button type="button" class="copy" data-copy>复制</button></div><pre><code>${code.replace(/\n$/, '')}</code></pre></div>`);
        return;
      }
      let list = null;
      const flush = () => { if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
      let para = [];
      const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
      for (const line of part.split('\n')) {
        let m;
        if (!line.trim()) { flushPara(); flush(); continue; }
        if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushPara(); flush(); out.push(`<h${m[1].length + 2}>${inline(m[2])}</h${m[1].length + 2}>`); continue; }
        if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { flushPara(); if (!list || list.tag !== 'ul') { flush(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); continue; }
        if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); if (!list || list.tag !== 'ol') { flush(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); continue; }
        if ((m = line.match(/^&gt;\s?(.*)$/))) { flushPara(); flush(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
        flush();
        para.push(line);
      }
      flushPara(); flush();
    });
    return out.join('');
  }

  window.renderMarkdown = render;
})();
