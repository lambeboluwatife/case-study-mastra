import { cohere } from "@ai-sdk/cohere";
import { MDocument } from "@mastra/rag";
import { mastra } from "../index.js";
import * as fs from "fs";
import * as path from "path"; 
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Read the content file
    const markdownContent = fs.readFileSync(
      path.join(__dirname, "../../docs/case-study-guide.md"),
      "utf-8"
    );

    const markdownDoc = new MDocument({
      docs: [{ text: markdownContent }],
      type: "markdown",
    });

    const chunks = await markdownDoc.chunk({
      strategy: "markdown",
      headers: [
        ["#", "Header 1"],
        ["##", "Header 2"],
        ["###", "Header 3"],
      ],
      maxSize: 1500,
      minSize: 500,
      overlap: 100,
    });

    console.log(`Found ${chunks.length} chunks to index`);

    // Get the vector store directly
    const vectorStore = mastra.getVector("mongodb");
    console.log("Checking vectorStore object in create-index:", vectorStore);
    if (!vectorStore) {
      throw new Error("MongoDB vector store not found");
    }
    await vectorStore.deleteIndex({indexName: "caseStudyGuide"});
    await vectorStore.createIndex({ indexName: "caseStudyGuide", dimension: 1536 });

    // Index the chunks directly using the vector store
    for (const chunk of chunks) {
      const embedResult = await cohere.embedding("embed-v4.0").doEmbed({
        values: [chunk.text],
      });

      await vectorStore.upsert({
        indexName: "caseStudyGuide",
        vectors: [embedResult.embeddings[0]],
        metadata: [
          {
            source: "caseStudyGuide.md",
            ...chunk.metadata,
            text: chunk.text,
          },
        ],
      });
      console.log("Indexed chunk:", chunk.text.substring(0, 50) + "...");
    }

    console.log("Indexing completed successfully!");
  } catch (error) {
    console.error("Error during indexing:", error);
  } finally {
    // No destroy() method on mastra; add cleanup here if necessary
  }
}

main();
