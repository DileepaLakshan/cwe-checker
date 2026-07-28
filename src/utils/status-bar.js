/**
 * Status bar utility functions
 */
export function showStatusBarMessage(message, isError = false) {
  const modeEl = document.getElementById('status-mode');
  
  modeEl.innerHTML = `<span class="status-dot ${isError ? 'error' : ''}"></span> ${message}`;

  setTimeout(() => {
    if (modeEl.innerText.includes(message)) {
      modeEl.innerHTML = `<span class="status-dot"></span> Ready`;
    }
  }, 4000);
}