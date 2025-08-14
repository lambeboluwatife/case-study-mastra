import * as dotenv from "dotenv";
dotenv.config();

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { sendMail, searchGoogle } from "../call";
import { embed } from "ai";
import { cohere } from "@ai-sdk/cohere";
import { rerank } from "@mastra/rag";
import fs from "fs";
import path from "path";
import { dirname } from "path";
import PDFDocument from "pdfkit";
import { format } from "date-fns";
import { fileURLToPath } from "url";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const sendMailTool = createTool({
  id: "send-mail",
  description: `Sends an email using the ArcadeAI Google.SendEmail tool.`,
  inputSchema: z.object({
    recipient: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body"),
  }),
  outputSchema: z.object({
    status: z.string().describe("Status of the email sending process"),
    details: z.any().optional().describe("Additional details or error info"),
  }),
  execute: async ({ context }) => {
    try {
      await sendMail({
        toolInput: {
          subject: context.subject,
          body: context.body,
          recipient: context.recipient,
        },
      });
      return { status: "Email sent successfully" };
    } catch (error) {
      console.error("Email sending failed:", error);
      return {
        status: `Failed to send email`,
        details: error?.message || error,
      };
    }
  },
});

export const searchGoogleTool = createTool({
  id: "search-google",
  description: `Fetches information from Google based on a specific search query. Use this tool when you need to find web-based information about a particular title, fact, or question. Returns multiple search results that can be used to provide comprehensive answers.`,
  inputSchema: z.object({
    query: z.string().describe("The search query to perform on Google"),
    n_results: z
      .number()
      .optional()
      .default(5)
      .describe("Number of results to return"),
  }),
  outputSchema: z.object({
    results: z.array(z.record(z.string(), z.any())), // Flexible: each result can have any shape
    raw: z.any().optional(), // Optionally include the raw response
    type: z.string().optional(), // Optionally include a type for context
  }),
  execute: async ({ context }) => {
    try {
      const result = await searchGoogle({
        toolInput: {
          query: context.query,
          n_results: context.n_results || 5,
        },
      });
      let output = result.output?.[0] || result.output;
      let results: any[] = [];
      // If output.value exists and is a string, try to parse it as JSON
      if (output && typeof output.value === "string") {
        try {
          const parsed = JSON.parse(output.value);
          if (Array.isArray(parsed)) {
            results = parsed;
          } else if (parsed && Array.isArray(parsed.results)) {
            results = parsed.results;
          }
        } catch (e) {
          console.warn("Failed to parse output.value as JSON:", e);
        }
      } else if (output && Array.isArray(output.results)) {
        results = output.results;
      }
      return { results, raw: output };
    } catch (error) {
      console.error("Google search failed:", error);
      return { results: [] };
    }
  },
});

export const caseStudyRAGTool = createTool({
  id: "case-study-rag",
  description: `Retrieves relevant information from embedded business case study documents using semantic search. This tool helps supplement analysis and answers based on real case study material stored in the MongoDB vector store.`,

  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "A natural language query related to a business case study — for example: 'What is the importance of SWOT in case analysis?' or 'List the limitations of case study method in business strategy.'"
      ),
    limit: z
      .number()
      .default(5)
      .describe("Maximum number of top results to return from the search"),
  }),

  execute: async (context) => {
    const { query, limit } = context;
    const mastra = context.mastra;

    if (!mastra) {
      throw new Error("Mastra instance not found in context");
    }

    const vectorStore = mastra?.getVector("mongodb");
    if (!vectorStore) {
      throw new Error("MongoDB vector store not found");
    }

    try {
      // Generate embedding for the query
      const { embedding } = await embed({
        model: cohere.embedding("embed-v4.0"),
        value: query,
      });

      // Perform vector search
      const results = await vectorStore.query({
        indexName: "caseStudyGuide",
        queryVector: embedding,
        topK: limit,
      });

      if (!results || results.length === 0) {
        return {
          results: [],
          message: "No relevant documents found for the query.",
        };
      }

      // Rerank the results
      const rerankedResults = await rerank(
        results,
        query,
        cohere("rerank-v3.5"),
        {
          topK: Math.min(3, results.length),
        }
      );

      return {
        results: rerankedResults,
        totalFound: results.length,
        query: query,
      };
    } catch (error: any) {
      console.error("Error in Case Study RAG search:", error);
      throw new Error(
        `Failed to perform case study RAG search: ${error.message}`
      );
    }
  },
});

export const createPDFTool = createTool({
  id: "create-pdf",
  description: `Generates a visually formatted PDF document (bold text, headers, clean paragraphs) from the provided content.`,
  inputSchema: z.object({
    content: z.string().describe("The text content to include in the PDF"),
    title: z.string().describe("Title for the PDF document"),
  }),
  outputSchema: z.object({
    pdfUrl: z.string().describe("URL to the generated PDF document"),
    status: z.string().describe("Status of the PDF generation process"),
  }),
  execute: async ({ context }) => {
    const { content, title } = context;

    const documentsPath = path.join(os.homedir(), "Documents", "case-studies");
    if (!fs.existsSync(documentsPath)) {
      fs.mkdirSync(documentsPath, { recursive: true });
    }

    const safeFilename = title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]/g, "");
    const date = format(new Date(), "yyyy-MM-dd");
    const pdfPath = path.join(documentsPath, `${safeFilename}-${date}.pdf`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(fs.createWriteStream(pdfPath));

    // ✨ HEADER
    doc
      .fontSize(20)
      .font("Times-Bold")
      .text(title.toUpperCase(), { align: "center" })
      .moveDown(0.5);

    doc
      .fontSize(12)
      .font("Times-Italic")
      .text(`Generated on ${date}`, { align: "center" })
      .moveDown(1.5);

    // ✍🏽 AUTHOR
    doc
      .font("Times-Roman")
      .fontSize(12)
      .text("Author: L.B.D's Case Study Agent", { align: "center" })
      .moveDown(2);

    // 📝 ARTICLE BODY with improved markdown handling
    const lines = content.split("\n");
    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        doc.moveDown();
        return;
      }

      if (/^\*\*(.+?)\*\*$/.test(trimmed)) {
        const match = trimmed.match(/^\*\*(.+?)\*\*$/);
        if (match) {
          doc
            .moveDown(0.5)
            .font("Times-Bold")
            .fontSize(13)
            .text(match[1], { align: "left" })
            .moveDown(0.5);
          return;
        }
      }

      if (/^\* +\*\*(.+?)\*\*: (.+)/.test(trimmed)) {
        const match = trimmed.match(/^\* +\*\*(.+?)\*\*: (.+)/);
        if (match) {
          doc
            .font("Times-Bold")
            .text("• " + match[1] + ": ", { continued: true })
            .font("Times-Roman")
            .text(match[2]);
          return;
        }
      }

      if (/^\* +(.+)/.test(trimmed)) {
        const match = trimmed.match(/^\* +(.+)/);
        doc.font("Times-Roman").text("• " + match[1]);
        return;
      }

      if (/^\d+\.\s+.+/.test(trimmed)) {
        doc.font("Times-Bold").fontSize(13).text(trimmed).moveDown(0.5);
        return;
      }

      doc.font("Times-Roman").fontSize(12).text(trimmed, {
        align: "justify",
        paragraphGap: 8,
      });
    });

    doc.end();

    const pdfUrl = `file://${pdfPath}`;
    console.log("✅ PDF saved to:", pdfPath);

    return {
      pdfUrl,
      status: "PDF generated successfully",
    };
  },
});

// export const createPDFTool = createTool({
//   id: "create-pdf",
//   description: `Generates a visually formatted PDF document (bold text, headers, clean paragraphs) from the provided content.`,
//   inputSchema: z.object({
//     content: z.string().describe("The text content to include in the PDF"),
//     title: z.string().describe("Title for the PDF document"),
//   }),
//   outputSchema: z.object({
//     pdfUrl: z.string().describe("URL to the generated PDF document"),
//     status: z.string().describe("Status of the PDF generation process"),
//   }),
//   execute: async ({ context }) => {
//     const { content, title } = context;

//     const documentsPath = path.join(os.homedir(), "Documents", "case-studies");
//     if (!fs.existsSync(documentsPath)) {
//       fs.mkdirSync(documentsPath, { recursive: true });
//     }

//     const safeFilename = title
//       .toLowerCase()
//       .replace(/\s+/g, "-")
//       .replace(/[^\w\-]/g, "");
//     const date = format(new Date(), "yyyy-MM-dd");
//     const pdfPath = path.join(documentsPath, `${safeFilename}-${date}.pdf`);

//     const doc = new PDFDocument({ margin: 50 });
//     doc.pipe(fs.createWriteStream(pdfPath));

//     // ✨ HEADER
//     doc
//       .fontSize(20)
//       .font("Times-Bold")
//       .text(title.toUpperCase(), { align: "center" })
//       .moveDown(0.5);

//     doc
//       .fontSize(12)
//       .font("Times-Italic")
//       .text(`Generated on ${date}`, { align: "center" })
//       .moveDown(1.5);

//     // ✍🏽 AUTHOR
//     doc
//       .font("Times-Roman")
//       .fontSize(12)
//       .text("Author: L.B.D's Case Study Agent", { align: "center" })
//       .moveDown(2);

//     // 📝 ARTICLE BODY with improved markdown handling
//     const lines = content.split("\n");
//     lines.forEach((line) => {
//       const trimmed = line.trim();

//       if (!trimmed) {
//         doc.moveDown(); // Blank line becomes paragraph break
//         return;
//       }

//       // Handle bold headers (e.g., "**1. Title?**")
//       if (/^\*\*(.+?)\*\*$/.test(trimmed)) {
//         const match = trimmed.match(/^\*\*(.+?)\*\*$/);
//         if (match) {
//           doc
//             .moveDown(0.5)
//             .font("Times-Bold")
//             .fontSize(13)
//             .text(match[1], { align: "left" })
//             .moveDown(0.5);
//           return;
//         }
//       }

//       // Handle list items (e.g., "* **Bold label:** content")
//       if (/^\* +\*\*(.+?)\*\*: (.+)/.test(trimmed)) {
//         const match = trimmed.match(/^\* +\*\*(.+?)\*\*: (.+)/);
//         if (match) {
//           doc
//             .font("Times-Bold")
//             .text("• " + match[1] + ": ", { continued: true })
//             .font("Times-Roman")
//             .text(match[2]);
//           return;
//         }
//       }

//       // Handle generic bullets (e.g., "* Some plain point")
//       if (/^\* +(.+)/.test(trimmed)) {
//         const match = trimmed.match(/^\* +(.+)/);
//         doc.font("Times-Roman").text("• " + match[1]);
//         return;
//       }

//       // Handle numbered headers like "1. What is...?"
//       if (/^\d+\.\s+.+/.test(trimmed)) {
//         doc.font("Times-Bold").fontSize(13).text(trimmed).moveDown(0.5);
//         return;
//       }

//       // Default paragraph
//       doc.font("Times-Roman").fontSize(12).text(trimmed, {
//         align: "justify",
//         paragraphGap: 8,
//       });
//     });

//     doc.end();

//     const pdfUrl = `file://${pdfPath}`;
//     console.log("✅ PDF saved to:", pdfPath);

//     return {
//       pdfUrl,
//       status: "PDF generated successfully",
//     };
//   },
// });
