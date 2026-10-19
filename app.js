    const htmlInput = document.getElementById("htmlInput");
    const preview = document.getElementById("preview");
    const status = document.getElementById("status");
    const downloadButton = document.getElementById("downloadButton");
    const fileInput = document.getElementById("fileInput");
    const themeToggle = document.getElementById("themeToggle");
    const themeIcon = document.getElementById("themeIcon");
    const themeLabel = document.getElementById("themeLabel");
    const sampleHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>A little color</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 48px; background: #f4f0ff; color: #272348; font-family: Arial, sans-serif; }
    .sheet { max-width: 650px; margin: 0 auto; padding: 42px; border-radius: 22px; background: white; box-shadow: 0 16px 45px #3927841c; }
    .tag { display: inline-block; padding: 8px 12px; border-radius: 99px; background: #e8e1ff; color: #6046d8; font-size: 13px; font-weight: bold; }
    h1 { margin: 22px 0 12px; font-size: 38px; }
    p { color: #5f5b70; line-height: 1.7; }
    .color-bar { height: 12px; margin: 28px 0; border-radius: 99px; background: #b79cff; }
    .note { padding: 17px 20px; border-left: 4px solid #f2ae3d; border-radius: 8px; background: #fff7e6; }
    .note strong { color: #885d12; }
    .footer { margin-top: 28px; color: #77728b; font-size: 12px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <main class="sheet">
    <span class="tag">YOUR FIRST COLORFUL PDF</span>
    <h1>Made to look just right.</h1>
    <p>Drop in your own HTML and CSS, check the live preview, and export a PDF. The colors and layout you see here are included in the download.</p>
    <div class="color-bar"></div>
    <div class="note"><strong>A little tip</strong><br>Use CSS page-break rules to control where long documents split across pages.</div>
    <div class="footer">Created with HTML → PDF · Right in your browser</div>
  </main>
</body>
</html>`;

    let previewTimer = 0;

    function setStatus(message, kind = "") {
      status.textContent = message;
      status.dataset.kind = kind;
    }

    function setTheme(theme, persist = false) {
      const isLight = theme === "light";
      const nextTheme = isLight ? "dark" : "light";
      document.documentElement.dataset.theme = isLight ? "light" : "dark";
      themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
      themeIcon.textContent = isLight ? "☾" : "☼";
      themeLabel.textContent = `${nextTheme[0].toUpperCase()}${nextTheme.slice(1)} mode`;
      document.querySelector('meta[name="theme-color"]').content = isLight ? "#f7f6ff" : "#10131d";
      if (persist) {
        try {
          window.localStorage.setItem("html-pdf-theme", isLight ? "light" : "dark");
        } catch (error) {
          console.warn("Could not save the theme preference:", error);
        }
      }
    }

    function updatePreview() {
      window.clearTimeout(previewTimer);
      previewTimer = window.setTimeout(() => {
        preview.srcdoc = htmlInput.value || "";
      }, 180);
    }

    function safeFileName(value) {
      const cleaned = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/g, "");
      return (cleaned || "document").slice(0, 100) + ".pdf";
    }

    function waitForFrame(frame) {
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("The document took too long to load. Check external images, fonts, or stylesheets and try again.")), 20000);
        frame.onload = () => {
          window.clearTimeout(timeout);
          resolve();
        };
        frame.onerror = () => {
          window.clearTimeout(timeout);
          reject(new Error("The HTML document could not be rendered."));
        };
      });
    }

    async function waitForDocumentAssets(doc) {
      if (doc.fonts && doc.fonts.ready) {
        await Promise.race([
          doc.fonts.ready,
          new Promise(resolve => window.setTimeout(resolve, 12000))
        ]);
      }

      const images = Array.from(doc.images);
      await Promise.all(images.map(async (image, index) => {
        image.loading = "eager";
        if (!image.complete) {
          await new Promise((resolve, reject) => {
            const timeout = window.setTimeout(() => reject(new Error(`Image ${index + 1} took too long to load.`)), 12000);
            image.addEventListener("load", () => {
              window.clearTimeout(timeout);
              resolve();
            }, { once: true });
            image.addEventListener("error", () => {
              window.clearTimeout(timeout);
              reject(new Error(`Image ${index + 1} could not be loaded. Check its URL or use an embedded image.`));
            }, { once: true });
          });
        }
        if (!image.naturalWidth) {
          throw new Error(`Image ${index + 1} could not be loaded. Check its URL or use an embedded image.`);
        }
        if (image.decode) {
          try {
            await image.decode();
          } catch {
            throw new Error(`Image ${index + 1} could not be decoded. Try another image or embed it as a data URL.`);
          }
        }
      }));
    }

    function preserveComputedStyles(doc) {
      const properties = [
        "display", "position", "top", "right", "bottom", "left", "float", "clear", "box-sizing",
        "width", "min-width", "max-width", "height", "min-height", "max-height",
        "margin-top", "margin-right", "margin-bottom", "margin-left",
        "padding-top", "padding-right", "padding-bottom", "padding-left",
        "overflow", "overflow-x", "overflow-y", "visibility", "opacity", "z-index",
        "transform", "transform-origin", "flex-grow", "flex-shrink", "flex-basis",
        "flex-direction", "flex-wrap", "align-content", "align-items", "align-self",
        "justify-content", "justify-items", "justify-self", "grid-template-columns",
        "grid-template-rows", "grid-column", "grid-row", "gap", "row-gap", "column-gap",
        "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
        "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
        "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
        "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
        "color", "background-color", "background-image", "background-position",
        "background-repeat", "background-size", "background-clip",
        "font-family", "font-size", "font-style", "font-weight", "line-height",
        "letter-spacing", "word-spacing", "text-align", "text-indent", "text-transform",
        "text-decoration-line", "text-decoration-color", "text-decoration-style",
        "vertical-align", "white-space", "word-break", "overflow-wrap",
        "list-style-type", "object-fit", "object-position", "box-shadow", "text-shadow",
        "break-before", "break-after", "break-inside",
        "page-break-before", "page-break-after", "page-break-inside"
      ];
      const elements = [doc.body, ...doc.body.querySelectorAll("*")];

      for (const element of elements) {
        const computed = doc.defaultView.getComputedStyle(element);
        for (const property of properties) {
          if (element === doc.body && property === "height") continue;
          const value = computed.getPropertyValue(property);
          if (value) element.style.setProperty(property, value, "important");
        }
      }
    }

    function scaleDocumentFonts(doc, scale) {
      if (scale === 1) return;

      const elements = [doc.body, ...doc.body.querySelectorAll("*")];
      const fontSizes = elements.map(element => {
        const computed = doc.defaultView.getComputedStyle(element);
        return {
          element,
          fontSize: Number.parseFloat(computed.fontSize),
          lineHeight: computed.lineHeight
        };
      });

      for (const { element, fontSize, lineHeight } of fontSizes) {
        if (Number.isFinite(fontSize)) {
          element.style.setProperty("font-size", `${fontSize * scale}px`, "important");
        }
        if (lineHeight.endsWith("px")) {
          const lineHeightSize = Number.parseFloat(lineHeight);
          if (Number.isFinite(lineHeightSize)) {
            element.style.setProperty("line-height", `${lineHeightSize * scale}px`, "important");
          }
        }
      }
    }

    async function downloadPdf() {
      if (!htmlInput.value.trim()) {
        setStatus("Add some HTML first, or load the sample to try it out.", "error");
        htmlInput.focus();
        return;
      }
      if (typeof window.html2pdf !== "function") {
        setStatus("The PDF engine could not load. Check your internet connection, then reload this page.", "error");
        return;
      }

      downloadButton.disabled = true;
      downloadButton.textContent = "Preparing your PDF…";
      setStatus("Rendering your page and loading its fonts and images…");

      const paper = "a4";
      const pageWidth = 794;
      const margin = 10;
      const width = pageWidth - (margin * 96 / 25.4 * 2);
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-same-origin");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;height:1000px;border:0;`;

      try {
        setStatus("Loading your HTML for export…");
        const loaded = waitForFrame(frame);
        frame.srcdoc = htmlInput.value;
        document.body.appendChild(frame);
        await loaded;
        setStatus("Waiting for fonts and images…");
        const doc = frame.contentDocument;
        if (!doc || !doc.body) {
          throw new Error("The HTML document could not be read. Make sure it contains valid HTML.");
        }
        await waitForDocumentAssets(doc);
        const fontScale = Number.parseFloat(document.getElementById("pdfFontScale").value);
        scaleDocumentFonts(doc, fontScale);
        preserveComputedStyles(doc);

        const body = doc.body;
        const contentHeight = Math.max(body.scrollHeight, body.offsetHeight, 100);
        frame.style.height = `${contentHeight}px`;
        await new Promise(resolve => window.setTimeout(resolve, 60));

        const bodyStyle = doc.defaultView.getComputedStyle(body);
        const bodyProperties = [
          "display", "position", "box-sizing", "color", "background-color", "background-image",
          "background-position", "background-repeat", "background-size", "font-family", "font-size",
          "font-style", "font-weight", "line-height", "letter-spacing", "word-spacing",
          "text-align", "text-indent", "text-transform", "direction", "writing-mode",
          "margin-top", "margin-right", "margin-bottom", "margin-left",
          "padding-top", "padding-right", "padding-bottom", "padding-left",
          "align-content", "align-items", "justify-content", "flex-direction", "flex-wrap",
          "gap", "row-gap", "column-gap", "width", "min-width", "max-width"
        ];
        const bodyStyles = Object.fromEntries(
          bodyProperties.map(property => [property, bodyStyle.getPropertyValue(property)])
        );
        const cssVariables = [];
        const rootStyle = doc.defaultView.getComputedStyle(doc.documentElement);
        for (let index = 0; index < rootStyle.length; index += 1) {
          const property = rootStyle[index];
          if (property.startsWith("--")) {
            cssVariables.push([property, rootStyle.getPropertyValue(property)]);
          }
        }
        const inlineStyles = Array.from(doc.head.querySelectorAll("style"))
          .map(style => style.textContent || "")
          .filter(Boolean);
        const linkedStyles = Array.from(doc.head.querySelectorAll('link[rel~="stylesheet"]:not([disabled])'))
          .map(link => ({
            href: link.href,
            media: link.media,
            crossOrigin: link.crossOrigin,
            referrerPolicy: link.referrerPolicy,
            integrity: link.integrity
          }));
        const scrollX = Math.max(0, (window.innerWidth - pageWidth) / 2);

        setStatus("Building your color PDF…");
        const options = {
          filename: safeFileName(document.getElementById("fileName").value),
          margin,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: "#ffffff",
            logging: false,
            scrollX,
            scrollY: 0,
            windowWidth: width,
            windowHeight: contentHeight,
            height: contentHeight,
            onclone: async clonedDocument => {
              const container = clonedDocument.querySelector(".html2pdf__container");
              const clonedBody = container && container.querySelector("body");
              if (!container || !clonedBody) {
                throw new Error("The document could not be prepared for PDF rendering.");
              }

              const style = clonedDocument.createElement("style");
              style.textContent = `${inlineStyles.join("\n")}\nhtml, body, * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }`;
              container.prepend(style);
              for (const [property, value] of Object.entries(bodyStyles)) {
                if (value) clonedBody.style.setProperty(property, value, "important");
              }
              for (const [property, value] of cssVariables) {
                clonedBody.style.setProperty(property, value);
              }
              container.style.setProperty("left", "0", "important");
              container.style.setProperty("right", "auto", "important");
              container.style.setProperty("margin", "0", "important");

              await Promise.all(linkedStyles.map(({ href, media, crossOrigin, referrerPolicy, integrity }) => new Promise((resolve, reject) => {
                const link = clonedDocument.createElement("link");
                link.rel = "stylesheet";
                link.href = href;
                link.media = media || "all";
                if (crossOrigin) link.crossOrigin = crossOrigin;
                if (referrerPolicy) link.referrerPolicy = referrerPolicy;
                if (integrity) link.integrity = integrity;
                const timeout = window.setTimeout(() => reject(new Error(`Stylesheet took too long to load: ${href}`)), 15000);
                link.addEventListener("load", () => {
                  window.clearTimeout(timeout);
                  resolve();
                }, { once: true });
                link.addEventListener("error", () => {
                  window.clearTimeout(timeout);
                  reject(new Error(`Stylesheet could not be loaded: ${href}`));
                }, { once: true });
                container.prepend(link);
              })));
            }
          },
          jsPDF: { unit: "mm", format: paper, orientation: "portrait", compress: true },
          pagebreak: {
            mode: ["css", "legacy"],
            avoid: ["img", "tr", ".keep-together", ".avoid-break"]
          }
        };

        const worker = window.html2pdf().set(options).from(body);
        await worker.toContainer();
        const container = await worker.get("container");
        const captureHeight = Math.max(container.scrollHeight, container.offsetHeight, contentHeight);
        worker.opt.html2canvas.height = captureHeight;
        worker.opt.html2canvas.windowHeight = captureHeight;
        await worker.toCanvas();
        await worker.toPdf();
        await worker.save();
        setStatus("Done — your PDF was downloaded in full color.", "success");
      } catch (error) {
        console.error("PDF export failed:", error);
        setStatus(error instanceof Error ? error.message : "PDF export failed. Please try again.", "error");
      } finally {
        frame.remove();
        downloadButton.disabled = false;
        downloadButton.innerHTML = "↓ &nbsp; Download PDF";
      }
    }

    document.getElementById("sampleButton").addEventListener("click", () => {
      htmlInput.value = sampleHtml;
      updatePreview();
      setStatus("Colorful sample loaded. Customize it or download it as-is.");
    });
    document.getElementById("clearButton").addEventListener("click", () => {
      htmlInput.value = "";
      updatePreview();
      setStatus("Editor cleared.");
    });
    document.getElementById("openFileButton").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      try {
        htmlInput.value = await file.text();
        document.getElementById("fileName").value = file.name.replace(/\.(html?|HTML?)$/, "") || "my-document";
        updatePreview();
        setStatus(`${file.name} loaded.`);
      } catch (error) {
        console.error("Could not read the selected HTML file:", error);
        setStatus("Could not read that file. Please try a different HTML file.", "error");
      } finally {
        fileInput.value = "";
      }
    });
    htmlInput.addEventListener("input", updatePreview);
    downloadButton.addEventListener("click", downloadPdf);
    themeToggle.addEventListener("click", () => {
      const currentTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
      setTheme(currentTheme === "light" ? "dark" : "light", true);
    });
    document.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        downloadPdf();
      }
    });

    let savedTheme = "dark";
    try {
      const preference = window.localStorage.getItem("html-pdf-theme");
      if (preference === "light" || preference === "dark") savedTheme = preference;
    } catch (error) {
      console.warn("Could not read the saved theme preference:", error);
    }
    setTheme(savedTheme);
    htmlInput.value = sampleHtml;
    updatePreview();
    if (typeof window.html2pdf !== "function") {
      window.addEventListener("load", () => {
        if (typeof window.html2pdf !== "function") {
          setStatus("PDF engine unavailable: connect to the internet and reload to enable downloads.", "warning");
        }
      }, { once: true });
    }
