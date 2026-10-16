/* Admin helpers. A small rich text editor for textareas marked data-richtext:
   Bold, Italic, Heading, Bullet list, Numbered list and Link. The server cleans
   everything again on save (includes/richtext.php). Without JavaScript the plain
   textarea stays and accepts the same simple HTML. */

document.querySelectorAll("textarea[data-richtext]").forEach((textarea) => {
    const tools = [
        ["bold", "Bold"],
        ["italic", "Italic"],
        ["formatBlock", "Heading", "h2"],
        ["formatBlock", "Paragraph", "p"],
        ["insertUnorderedList", "Bullet list"],
        ["insertOrderedList", "Numbered list"],
        ["createLink", "Link"],
    ];
    const toolbar = document.createElement("div");
    toolbar.className = "rte__toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Text formatting");

    const editor = document.createElement("div");
    editor.className = "input rte__area";
    editor.contentEditable = "true";
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    editor.setAttribute("aria-labelledby", textarea.id + "-label");
    if (textarea.getAttribute("aria-describedby")) {
        editor.setAttribute("aria-describedby", textarea.getAttribute("aria-describedby"));
    }
    if (textarea.disabled) {
        editor.contentEditable = "false";
    }
    editor.innerHTML = textarea.value; // already cleaned by the server

    tools.forEach(([command, label, value]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn--ghost";
        button.textContent = label;
        button.disabled = textarea.disabled;
        button.addEventListener("click", () => {
            editor.focus();
            if (command === "createLink") {
                const href = window.prompt("Link address, starting with https://");
                if (href) document.execCommand("createLink", false, href);
            } else {
                document.execCommand(command, false, value || null);
            }
        });
        toolbar.append(button);
    });

    // A hidden required textarea would block the submit before it is filled in,
    // so the editor takes over its id (error links point here), required and invalid
    // states. The server still rejects an empty required field.
    editor.setAttribute("aria-required", String(textarea.required));
    if (textarea.getAttribute("aria-invalid")) {
        editor.setAttribute("aria-invalid", textarea.getAttribute("aria-invalid"));
    }
    textarea.required = false;
    editor.id = textarea.id;
    textarea.id += "-source";

    textarea.hidden = true;
    textarea.before(toolbar, editor);
    textarea.form?.addEventListener("submit", () => {
        textarea.value = editor.innerHTML;
    });
});

/* Photos larger than 1600 pixels are scaled down here before they upload, so
   pages stay light on slow connections. Without this script the server asks
   for a smaller image (includes/upload.php, IMAGE_MAX_SIDE). */
const MAX_IMAGE_SIDE = 1600;
document.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener("change", async () => {
        const file = input.files[0];
        if (!file || !/^image\/(jpeg|png)$/.test(file.type) || !window.createImageBitmap) return;
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        const scale = MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height);
        if (scale >= 1) return;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, file.type, 0.85));
        if (!blob) return;
        const smaller = new DataTransfer();
        smaller.items.add(new File([blob], file.name, { type: file.type }));
        input.files = smaller.files;
    });
});
