/**
 * Editor-specific event handlers
 */
import { getDOM } from '../utils/dom-references';
import { getActiveTab, findTab, updateTabContent } from '../state/ide-state';
import { renderTabs } from '../components/tabs';
import { updateLineNumbers, updateLineCol } from '../utils/editor-utils';

export function initEditorEvents() {
  const { codeTextarea, lineNumbersContainer } = getDOM();

  // Scroll synchronization
  codeTextarea.addEventListener('scroll', () => {
    lineNumbersContainer.scrollTop = codeTextarea.scrollTop;
  });

  // Content change handling
  codeTextarea.addEventListener('input', () => {
    const activeTab = getActiveTab();
    if (activeTab) {
      updateTabContent(activeTab, codeTextarea.value);
      renderTabs();
    }
    updateLineNumbers();
    updateLineCol();
  });

  // Caret position updates
  codeTextarea.addEventListener('keyup', updateLineCol);
  codeTextarea.addEventListener('click', updateLineCol);

  // Tab key handling for indentation
  codeTextarea.addEventListener('keydown', handleTabKey);
}

function handleTabKey(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    textarea.value = val.substring(0, start) + '    ' + val.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + 4;
    textarea.dispatchEvent(new Event('input'));
  }
}