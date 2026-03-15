// ReviewLens — PR data extractor
// Uses GitHub API to fetch diff invisibly — no tab switching

function getPRInfo() {
  // Extract owner, repo, PR number from URL
  const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: match[3] };
}

function extractPageData() {
  // Extract what's already on the page — title, description, stats
  const data = {
    title: '',
    description: '',
    additions: 0,
    deletions: 0,
    filesChanged: 0,
  };

  const titleEl = document.querySelector(
    'h1.gh-header-title .js-issue-title, bdi.js-issue-title, ' +
    'h1 span.js-issue-title, .js-issue-title'
  );
  if (titleEl) data.title = titleEl.innerText.trim();

  const descEl = document.querySelector('.comment-body.js-comment-body, .js-comment-body');
  if (descEl) data.description = descEl.innerText.trim().slice(0, 800);

  const addEl = document.querySelector('.diffstat .color-fg-success');
  const delEl = document.querySelector('.diffstat .color-fg-danger');
  if (addEl) data.additions = parseInt(addEl.innerText.replace(/\D/g, '')) || 0;
  if (delEl) data.deletions = parseInt(delEl.innerText.replace(/\D/g, '')) || 0;

  return data;
}

async function fetchDiffFromAPI(owner, repo, number) {
  // GitHub API — returns file list with patches
  // Works for public repos without auth
  // Returns up to 300 files, 3000 lines per file
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (!res.ok) return null;

    const files = await res.json();
    if (!Array.isArray(files)) return null;

    // Priority order for diff extraction
    const PRIORITY_PATTERNS = [
      { pattern: /auth|security|permission|token|password|secret|key|jwt|oauth/i, priority: 1 },
      { pattern: /middleware|route|api|controller|handler/i, priority: 2 },
      { pattern: /database|migration|schema|model|query/i, priority: 2 },
      { pattern: /test|spec/i, priority: 3 },
      { pattern: /config|env|setting/i, priority: 3 },
    ];

    function getFilePriority(path) {
      for (const { pattern, priority } of PRIORITY_PATTERNS) {
        if (pattern.test(path)) return priority;
      }
      return 4;
    }

    const sorted = [...files].sort((a, b) =>
      getFilePriority(a.filename) - getFilePriority(b.filename)
    );

    // Build structured file list
    const fileList = files.map(f => ({
      path: f.filename,
      ext: f.filename.split('.').pop().toLowerCase(),
      status: f.status, // added, modified, removed, renamed
      additions: f.additions,
      deletions: f.deletions,
      isTest: /test|spec|__tests__/.test(f.filename.toLowerCase()),
      patch: f.patch || '' // actual diff patch
    }));

    // Build prioritized diff string
    let diff = '';
    let totalChars = 0;
    const MAX_CHARS = 6000;

    sorted.forEach(f => {
      if (totalChars >= MAX_CHARS || !f.patch) return;
      const chunk = `\n[${f.filename}] ${f.status} +${f.additions} -${f.deletions}\n${f.patch.slice(0, 800)}`;
      diff += chunk;
      totalChars += chunk.length;
    });

    return {
      files: fileList,
      diff,
      filesChanged: files.length,
      testFilesChanged: fileList.some(f => f.isTest),
      fileTypes: [...new Set(fileList.map(f => f.ext))].slice(0, 8)
    };

  } catch (e) {
    return null;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractPR') {
    const prInfo = getPRInfo();

    if (!prInfo) {
      sendResponse({ success: false });
      return true;
    }

    const pageData = extractPageData();

    // Fetch diff from GitHub API invisibly
    fetchDiffFromAPI(prInfo.owner, prInfo.repo, prInfo.number).then(apiData => {
      const combined = {
        ...pageData,
        files: apiData?.files || [],
        diff: apiData?.diff || '',
        filesChanged: apiData?.filesChanged || pageData.filesChanged,
        testFilesChanged: apiData?.testFilesChanged || false,
        fileTypes: apiData?.fileTypes || []
      };
      sendResponse({ success: true, data: combined });
    });
  }
  return true;
});
