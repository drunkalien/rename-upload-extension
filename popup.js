const filenameInput = document.getElementById("filename");
const enabledInput = document.getElementById("enabled");
const status = document.getElementById("status");

// Load saved values when popup opens
chrome.storage.sync.get(["newFilename", "enabled"], (data) => {
  filenameInput.value = data.newFilename || "";
  enabledInput.checked = data.enabled ?? true;
});

document.getElementById("save").addEventListener("click", () => {
  const newFilename = filenameInput.value.trim();
  const enabled = enabledInput.checked;

  chrome.storage.sync.set({ newFilename, enabled }, () => {
    status.textContent = "Saved!";
    setTimeout(() => (status.textContent = ""), 1500);
  });
});
