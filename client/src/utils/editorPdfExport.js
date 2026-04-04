let pdfMakeInstance = null;
let pdfMakePromise = null;
let jsPdfModulePromise = null;

async function getPdfMake() {
  if (pdfMakeInstance) return pdfMakeInstance;
  if (!pdfMakePromise) {
    pdfMakePromise = Promise.all([
      import("pdfmake/build/pdfmake"),
      import("pdfmake/build/vfs_fonts"),
    ]).then(([pdfMakeLib, pdfFontsLib]) => {
      const pdfMake = pdfMakeLib?.default || pdfMakeLib;
      const pdfFonts = pdfFontsLib?.default || pdfFontsLib;

      if (typeof pdfMake.addVirtualFileSystem === "function") {
        pdfMake.addVirtualFileSystem(pdfFonts);
      } else {
        const fallbackVfs = pdfFonts?.pdfMake?.vfs || pdfFonts?.vfs || pdfFonts;
        pdfMake.vfs = fallbackVfs;
      }

      pdfMakeInstance = pdfMake;
      return pdfMake;
    });
  }

  return pdfMakePromise;
}

async function getJsPdf() {
  if (!jsPdfModulePromise) {
    jsPdfModulePromise = import("jspdf").then((module) => module.jsPDF);
  }

  return jsPdfModulePromise;
}

function sanitizePdfFileName(fileName) {
  const baseName = String(fileName || "document")
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w\- ]+/g, "_")
    .trim();

  return `${baseName || "document"}.pdf`;
}

function normalizeParagraphs(content) {
  return String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]));
}

async function exportWithPdfMake({ kind, fileName, content, sheetRows }) {
  const pdfMake = await getPdfMake();
  let docDefinition;

  if (kind === "xlsx") {
    const rows = Array.isArray(sheetRows) && sheetRows.length > 0 ? sheetRows : [[""]];
    const columnCount = Math.max(...rows.map((row) => row.length), 1);
    const normalizedRows = rows.map((row) =>
      Array.from({ length: columnCount }, (_, index) => String(row[index] || ""))
    );

    docDefinition = {
      pageOrientation: columnCount > 6 ? "landscape" : "portrait",
      pageMargins: [28, 28, 28, 28],
      content: [
        { text: fileName || "Spreadsheet Export", style: "title" },
        {
          margin: [0, 10, 0, 0],
          table: {
            headerRows: 1,
            widths: Array.from({ length: columnCount }, () => "*"),
            body: normalizedRows,
          },
          layout: "lightHorizontalLines",
        },
      ],
      styles: {
        title: { fontSize: 18, bold: true },
      },
      defaultStyle: {
        fontSize: 9,
      },
    };
  } else {
    const paragraphs = normalizeParagraphs(content);
    docDefinition = {
      pageMargins: [40, 40, 40, 40],
      content: [
        { text: fileName || "Document Export", style: "title" },
        {
          margin: [0, 12, 0, 0],
          stack: paragraphs.length
            ? paragraphs.map((line) => ({ text: line || " ", margin: [0, 0, 0, 6] }))
            : [{ text: "No content available." }],
        },
      ],
      styles: {
        title: { fontSize: 18, bold: true },
      },
      defaultStyle: {
        fontSize: 11,
        lineHeight: 1.2,
      },
    };
  }

  pdfMake.createPdf(docDefinition).download(sanitizePdfFileName(fileName));
  return { library: "pdfmake" };
}

function addWrappedText(doc, text, x, y, maxWidth, lineHeight, bottomMargin) {
  const lines = doc.splitTextToSize(String(text || ""), maxWidth);
  let cursorY = y;

  lines.forEach((line) => {
    if (cursorY > bottomMargin) {
      doc.addPage();
      cursorY = 56;
    }

    doc.text(line, x, cursorY);
    cursorY += lineHeight;
  });

  return cursorY;
}

async function exportWithJsPdf({ kind, fileName, content, slides }) {
  const jsPDF = await getJsPdf();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - 80;
  const bottomMargin = pageHeight - 56;

  if (kind === "pptx") {
    const slideDeck = Array.isArray(slides) && slides.length > 0 ? slides : [{ title: "Slide 1", body: "" }];

    slideDeck.forEach((slide, index) => {
      if (index > 0) doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text(String(slide.title || `Slide ${index + 1}`), 40, 58);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      addWrappedText(doc, slide.body || "", 40, 92, maxWidth, 18, bottomMargin);
    });
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(String(fileName || "PDF Export"), 40, 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    addWrappedText(doc, content || "", 40, 82, maxWidth, 16, bottomMargin);
  }

  doc.save(sanitizePdfFileName(fileName));
  return { library: "jspdf" };
}

export async function exportEditorContentToPdf({
  kind,
  fileName,
  content,
  sheetRows,
  slides,
}) {
  if (kind === "pptx" || kind === "pdf") {
    return await exportWithJsPdf({ kind, fileName, content, slides });
  }

  try {
    return await exportWithPdfMake({ kind, fileName, content, sheetRows });
  } catch {
    return await exportWithJsPdf({ kind, fileName, content, slides });
  }
}
