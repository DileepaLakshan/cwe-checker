/**
 * Editor utility functions
 */
import { getDOM } from './dom-references';

export function updateLineNumbers() {
  const { codeTextarea, lineNumbers } = getDOM();
  if (!codeTextarea || !lineNumbers) return;
  
  const lines = codeTextarea.value.split('\n');
  const count = lines.length;

  let content = '';
  for (let i = 1; i <= count; i++) {
    content += i + '\n';
  }
  lineNumbers.innerText = content;
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

export function scrollToLine(lineNumber) {
  const { codeTextarea } = getDOM();
  if (!codeTextarea) return;
  
  const lines = codeTextarea.value.split('\n');
  const target = Math.max(1, Math.min(lineNumber, lines.length));
  let position = 0;
  for (let i = 1; i < target; i++) {
    position += lines[i - 1].length + 1;
  }
  codeTextarea.selectionStart = codeTextarea.selectionEnd = position;
  codeTextarea.focus();
  updateLineCol();
}