let settings = { newFilename: "", enabled: true };

// Load current settings on page load
chrome.storage.sync.get(["newFilename", "enabled"], (data) => {
  settings.newFilename = data.newFilename || "";
  settings.enabled = data.enabled ?? true;
});

// Keep settings in sync if changed while page is open
chrome.storage.onChanged.addListener((changes) => {
  if (changes.newFilename) settings.newFilename = changes.newFilename.newValue;
  if (changes.enabled) settings.enabled = changes.enabled.newValue;
});

function renameFile(file, newName) {
  return new File([file], newName, { type: file.type, lastModified: file.lastModified });
}

function handleFileInput(input) {
  input.addEventListener("change", () => {
    if (!settings.enabled || !settings.newFilename) return;
    if (!input.files || input.files.length === 0) return;

    const dt = new DataTransfer();
    const files = Array.from(input.files);

    files.forEach((file, i) => {
      let newName = settings.newFilename;
      if (files.length > 1) {
        // avoid collisions: name_1.pdf, name_2.pdf, etc.
        const dot = newName.lastIndexOf(".");
        newName = dot === -1
          ? `${newName}_${i + 1}`
          : `${newName.slice(0, dot)}_${i + 1}${newName.slice(dot)}`;
      }
      dt.items.add(renameFile(file, newName));
    });

    input.files = dt.files;
  });
}

document.querySelectorAll('input[type="file"]').forEach(handleFileInput);

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches?.('input[type="file"]')) handleFileInput(node);
      node.querySelectorAll?.('input[type="file"]').forEach(handleFileInput);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });
