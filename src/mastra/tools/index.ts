import * as dotenv from "dotenv";
dotenv.config();

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { sendMail, searchGoogle } from "../call";
import { embed } from "ai";
import { cohere } from "@ai-sdk/cohere";
import { rerank } from "@mastra/rag";

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
  description: `Fetches information from Google based on a specific search query. Use this tool when you need to find web-based information about a particular topic, fact, or question. Returns multiple search results that can be used to provide comprehensive answers.`,
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
      throw new Error(`Failed to perform case study RAG search: ${error.message}`);
    }
  },
});

