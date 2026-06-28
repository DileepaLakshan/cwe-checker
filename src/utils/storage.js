/**
 * Local storage utility functions
 */
export function getRecentProjects() {
  try {
    return JSON.parse(localStorage.getItem('recent_workspaces') || '[]');
  } catch {
    return [];
  }
}

export function addRecentProject(dirPath, dirName) {
  let recents = getRecentProjects();
  recents = recents.filter(p => p.path !== dirPath);
  recents.unshift({ path: dirPath, name: dirName });
  if (recents.length > 5) recents.pop();
  localStorage.setItem('recent_workspaces', JSON.stringify(recents));
}