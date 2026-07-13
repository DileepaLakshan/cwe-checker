/**
 * Editor utility functions
 */
import { getDOM } from './dom-references';

export function updateLineNumbers() {
  const { codeTextarea, lineNumbers } = getDOM();
  if (!codeTextarea || !lineNumbers) return;
  
  const lines = codeTextarea.value.split('\n');
  const count = lines.length;

  let html = '';
  for (let i = 1; i <= count; i++) {
    html += `<span class="line-num" data-line="${i}">${i}</span>\n`;
  }
  lineNumbers.innerHTML = html;
}

export function updateLineCol() {
  const { codeTextarea } = getDOM();
  const text = codeTextarea.value;
  const caret = codeTextarea.selectionStart;

  const upToCaret = text.substring(0, caret);
  const rows = upToCaret.split('\n');
  const ln = rows.length;
  const col = rows[rows.length - 1].length + 1;

  const lineColEl = document.getElementById('status-line-col');
  if (lineColEl) {
    lineColEl.innerText = `Ln ${ln}, Col ${col}`;
  }
}

export function scrollToLine(lineNumber, highlight = false) {
  const { codeTextarea } = getDOM();
  if (!codeTextarea) return;
  
  const lines = codeTextarea.value.split('\n');
  const target = Math.max(1, Math.min(lineNumber, lines.length));
  let position = 0;
  for (let i = 1; i < target; i++) {
    position += lines[i - 1].length + 1;
  }

  // Handle line number background styling
  document.querySelectorAll('.line-num.error-highlight').forEach(el => el.classList.remove('error-highlight'));
  
  // Clear any existing textarea background highlight
  codeTextarea.style.background = '';
  codeTextarea.style.backgroundAttachment = '';
  
  const lineHeight = 20;
  const paddingTop = 16;
  const topOffset = paddingTop + (target - 1) * lineHeight;

  if (highlight) {
    const el = document.querySelector(`.line-num[data-line="${target}"]`);
    if (el) el.classList.add('error-highlight');
    
    // Highlight directly on the textarea using a linear-gradient background that scrolls with content
    codeTextarea.style.background = `linear-gradient(to bottom, transparent ${topOffset}px, rgba(248, 81, 73, 0.15) ${topOffset}px, rgba(248, 81, 73, 0.15) ${topOffset + lineHeight}px, transparent ${topOffset + lineHeight}px)`;
    codeTextarea.style.backgroundAttachment = 'local';
    
    // Select the entire line for visual emphasis in the textarea
    codeTextarea.selectionStart = position;
    codeTextarea.selectionEnd = position + lines[target - 1].length;
  } else {
    codeTextarea.selectionStart = codeTextarea.selectionEnd = position;
  }
  
  codeTextarea.focus();
  
  // Ensure the line is scrolled into view (centered)
  const clientHeight = codeTextarea.clientHeight;
  codeTextarea.scrollTop = Math.max(0, topOffset - clientHeight / 2);
  
  updateLineCol();
}