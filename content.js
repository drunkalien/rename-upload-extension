(() => {
  const HISTORY_LIMIT = 50;
  const SUGGESTION_LIMIT = 5;

  let settings = { enabled: true, excludedSites: [] };
  let history = []; // [{ original, renamed, ts }] most recent first

  chrome.storage.local.get(["settings", "history"], (data) => {
    if (data.settings) settings = { ...settings, ...data.settings };
    if (data.history) history = data.history;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.settings)
      settings = { ...settings, ...changes.settings.newValue };
    if (changes.history) history = changes.history.newValue || [];
  });

  function isExcluded(hostname) {
    return settings.excludedSites.some(
      (site) => hostname === site || hostname.endsWith("." + site),
    );
  }

  function splitName(filename) {
    const dot = filename.lastIndexOf(".");
    // dot <= 0 also treats dotfiles like ".env" as having no extension
    if (dot <= 0) return { base: filename, ext: "" };
    return { base: filename.slice(0, dot), ext: filename.slice(dot) };
  }

  // Base names to offer as suggestions: previous renames of these exact
  // files first, then other recent renames.
  function suggestionsFor(files) {
    const seen = new Set(files.map((f) => splitName(f.name).base));
    const out = [];
    const add = (name) => {
      const { base } = splitName(name);
      if (base && !seen.has(base) && out.length < SUGGESTION_LIMIT) {
        seen.add(base);
        out.push(base);
      }
    };
    for (const f of files) {
      for (const h of history) if (h.original === f.name) add(h.renamed);
    }
    for (const h of history) add(h.renamed);
    return out;
  }

  function recordRenames(files, newNames) {
    const entries = files
      .map((f, i) => ({
        original: f.name,
        renamed: newNames[i],
        ts: Date.now(),
      }))
      .filter((e) => e.original !== e.renamed);
    if (entries.length === 0) return;
    history = [...entries, ...history].slice(0, HISTORY_LIMIT);
    chrome.storage.local.set({ history });
  }

  // Shows a modal asking the user to rename the selected files.
  // Resolves with an array of new names, or null if the user keeps the originals.
  function showRenameDialog(files) {
    return new Promise((resolve) => {
      const host = document.createElement("div");
      const shadow = host.attachShadow({ mode: "closed" });

      const style = document.createElement("style");
      style.textContent = `
        .overlay {
          position: fixed; inset: 0; z-index: 2147483647;
          background: rgba(0, 0, 0, 0.45);
          display: flex; align-items: center; justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .panel {
          /* explicit light palette everywhere — the host page's dark mode
             (color-scheme) must not restyle any part of this dialog */
          color-scheme: light;
          background: #fff; color: #222; border-radius: 10px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
          padding: 20px; width: 340px; max-width: 90vw;
        }
        h2 { margin: 0 0 12px; font-size: 15px; font-weight: 600; }
        .row { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
        .row input {
          flex: 1; min-width: 0; padding: 6px 8px; font-size: 13px;
          border: 1px solid #ccc; border-radius: 6px;
          background: #fff; color: #222;
        }
        .row .ext { font-size: 13px; color: #666; white-space: nowrap; }
        .suggestions { margin-top: 10px; }
        .suggestions .label { font-size: 11px; color: #888; display: block; margin-bottom: 4px; }
        .chip {
          display: inline-block; margin: 0 4px 4px 0; padding: 3px 10px;
          font-size: 12px; border-radius: 12px; cursor: pointer;
          border: 1px solid #cbd5e1; background: #f1f5f9; color: #333;
        }
        .chip:hover { background: #e2e8f0; }
        .buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
        button {
          padding: 6px 14px; font-size: 13px; border-radius: 6px;
          border: 1px solid #ccc; background: #f5f5f5; color: #222; cursor: pointer;
        }
        button.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
      `;

      const overlay = document.createElement("div");
      overlay.className = "overlay";
      const panel = document.createElement("div");
      panel.className = "panel";

      const title = document.createElement("h2");
      title.textContent =
        files.length === 1
          ? "Rename file before upload?"
          : "Rename files before upload?";
      panel.appendChild(title);

      const parts = files.map((f) => splitName(f.name));
      const nameInputs = parts.map(({ base, ext }) => {
        const row = document.createElement("div");
        row.className = "row";
        const input = document.createElement("input");
        input.type = "text";
        input.value = base;
        row.appendChild(input);
        if (ext) {
          const extSpan = document.createElement("span");
          extSpan.className = "ext";
          extSpan.textContent = ext;
          row.appendChild(extSpan);
        }
        panel.appendChild(row);
        return input;
      });

      // clicking a suggestion fills the last-focused name input
      let activeInput = nameInputs[0];
      panel.addEventListener("focusin", (e) => {
        if (nameInputs.includes(e.target)) activeInput = e.target;
      });

      const suggested = suggestionsFor(files);
      if (suggested.length > 0) {
        const box = document.createElement("div");
        box.className = "suggestions";
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = "Previously used names:";
        box.appendChild(label);
        for (const base of suggested) {
          const chip = document.createElement("span");
          chip.className = "chip";
          chip.textContent = base;
          chip.addEventListener("click", () => {
            activeInput.value = base;
            activeInput.focus();
          });
          box.appendChild(chip);
        }
        panel.appendChild(box);
      }

      const buttons = document.createElement("div");
      buttons.className = "buttons";
      const keepBtn = document.createElement("button");
      keepBtn.textContent = "Keep original";
      const renameBtn = document.createElement("button");
      renameBtn.className = "primary";
      renameBtn.textContent = "Rename";
      buttons.append(keepBtn, renameBtn);
      panel.appendChild(buttons);

      overlay.appendChild(panel);
      shadow.append(style, overlay);
      document.documentElement.appendChild(host);

      function finish(names) {
        host.remove();
        resolve(names);
      }

      renameBtn.addEventListener("click", () => {
        finish(
          nameInputs.map((input, i) => {
            const base = input.value.trim();
            // empty name → keep that file's original name
            return base ? base + parts[i].ext : files[i].name;
          }),
        );
      });
      keepBtn.addEventListener("click", () => finish(null));
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.keyCode === 13) renameBtn.click();
        if (e.key === "Escape" || e.keyCode === 27) keepBtn.click();
        e.stopPropagation();
      });
      // don't let clicks/keys leak to the page while the dialog is open
      overlay.addEventListener("click", (e) => e.stopPropagation());

      nameInputs[0].focus();
      nameInputs[0].select();
    });
  }

  // True while we re-dispatch the change event below, so we don't
  // intercept our own event and loop.
  let releasing = false;

  // Capture-phase listener on document fires before the page's own handlers,
  // so we can hold the change event until the user has decided.
  document.addEventListener(
    "change",
    async (e) => {
      if (releasing) return;
      if (!settings.enabled || isExcluded(location.hostname)) return;
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
      if (!input.files || input.files.length === 0) return;

      e.stopImmediatePropagation();

      // read the latest history right before showing suggestions, in case
      // renames happened in other tabs or before this script's initial load
      await new Promise((resolve) =>
        chrome.storage.local.get("history", (data) => {
          if (data.history) history = data.history;
          resolve();
        }),
      );

      const files = Array.from(input.files);
      const newNames = await showRenameDialog(files);

      if (newNames && newNames.some((name, i) => name !== files[i].name)) {
        const dt = new DataTransfer();
        files.forEach((file, i) => {
          dt.items.add(
            newNames[i] === file.name
              ? file
              : new File([file], newNames[i], {
                  type: file.type,
                  lastModified: file.lastModified,
                }),
          );
        });
        input.files = dt.files;
        recordRenames(files, newNames);
      }

      // release the (possibly renamed) files to the page
      releasing = true;
      try {
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } finally {
        releasing = false;
      }
    },
    true,
  );
})();
