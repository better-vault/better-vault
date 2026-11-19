import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { docxToText, epubToText, pptxToText, xlsxToText } from "./office";

const zip = (files: Record<string, string>) =>
  zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])));

describe("office files", () => {
  it("reads a Word document's paragraphs", () => {
    const data = zip({
      "word/document.xml": `<w:document><w:body>
        <w:p><w:r><w:t>Hello</w:t></w:r><w:r><w:t xml:space="preserve"> world &amp; all</w:t></w:r></w:p>
        <w:p><w:r><w:t>Second</w:t></w:r><w:r><w:tab/><w:t>line</w:t></w:r></w:p>
      </w:body></w:document>`,
    });
    expect(docxToText(data)).toBe("Hello world & all\nSecond\tline");
  });

  it("reads each sheet of a workbook as rows", () => {
    const data = zip({
      "xl/workbook.xml": `<workbook><sheets><sheet name="People" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
      "xl/sharedStrings.xml": `<sst><si><t>Name</t></si><si><t>Age</t></si><si><t>Ada</t></si></sst>`,
      "xl/worksheets/sheet1.xml": `<worksheet><sheetData>
        <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
        <row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>36</v></c></row>
      </sheetData></worksheet>`,
    });
    expect(xlsxToText(data)).toBe("## People\nName | Age\nAda |  | 36");
  });

  it("reads slides in order, with their notes", () => {
    const slide = (text: string) => `<p:sld><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sld>`;
    const data = zip({
      "ppt/slides/slide10.xml": slide("Last"),
      "ppt/slides/slide2.xml": slide("Second"),
      "ppt/slides/slide1.xml": slide("First"),
      "ppt/notesSlides/notesSlide1.xml": `<p:notes><a:p><a:r><a:t>Say hello</a:t></a:r></a:p><a:p><a:r><a:t>1</a:t></a:r></a:p></p:notes>`,
    });
    expect(pptxToText(data)).toBe(
      "Slide 1\nFirst\nNotes: Say hello\n\nSlide 2\nSecond\n\nSlide 10\nLast",
    );
  });

  it("reads a book's chapters in spine order", () => {
    const data = zip({
      "META-INF/container.xml": `<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`,
      "OEBPS/content.opf": `<package><metadata><dc:title>A Book</dc:title></metadata>
        <manifest><item id="b" href="two.xhtml"/><item id="a" href="one.xhtml"/></manifest>
        <spine><itemref idref="a"/><itemref idref="b"/></spine></package>`,
      "OEBPS/one.xhtml": `<html><body><h1>One</h1><p>First chapter.</p></body></html>`,
      "OEBPS/two.xhtml": `<html><body><h1>Two</h1></body></html>`,
    });
    const book = epubToText(data);
    expect(book.title).toBe("A Book");
    expect(book.text.replace(/\s+/g, " ").trim()).toBe("OneFirst chapter. Two");
  });

  it("refuses files that are not what they say", () => {
    expect(() => docxToText(zip({ "other.xml": "<x/>" }))).toThrow();
  });
});
