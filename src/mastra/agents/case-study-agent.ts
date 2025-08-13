import { OpenAIVoice } from "@mastra/voice-openai";
import { createReadStream, createWriteStream } from "fs";
import { PlayAIVoice } from "@mastra/voice-playai";
import { GoogleVoice } from "@mastra/voice-google";
// import { playAudio, getMicrophoneStream } from "@mastra/node-audio";
import path from "path";
import { google } from "@ai-sdk/google";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import mic from "mic";
import player from "play-sound";
import { searchGoogleTool, sendMailTool, createPDFTool } from "../tools";

const voice = new OpenAIVoice();

export const voiceAgent = new Agent({
  name: "Voice Agent",
  instructions:
    "You are a voice assistant that can answer questions, perform tasks, and interact with users through voice.",
  model: google("gemini-2.0-flash-exp"),
  voice,
});

export const caseStudyAgent = new Agent({
  name: "Case Study Agent",
  instructions: `
You are an intelligent and structured agent built to deeply analyze business case studies, deliver insights, and export well-structured reports in PDF format.

=== DOMAIN EXPERTISE ===
You specialize in strategic management, organizational behavior, business operations, HR, finance, marketing, business environment, environmental scanning and analysis, and more. You can apply frameworks such as SWOT, TOWS, PESTEL, Porter's Five Forces, BCG, and Value Chain to support your responses.

=== CASE ANALYSIS APPROACH ===
Always analyze cases using this structured method:
1. Read and identify important vs. minor issues
2. Reread to detect environmental opportunities/threats
3. Prioritize external factors and their impact on strategy
4. Critically evaluate strategic alternatives
5. Clarify steps for adopting the selected strategy
6. Reassess the final recommendation and outline execution plan
7. Format final insights into a well-structured written report or oral presentation

=== RESPONSIBILITIES ===
1. **Answer Questions or Analyze the Full Case:**
   - If questions are provided, answer them thoroughly using business logic.
   - If not, ask: “Would you like me to generate relevant questions based on this case?”

2. **Prepare Markdown-like, Well-Formatted Reports:**
   - Use clear section headers (e.g., **Key Issues**, **SWOT Analysis**, **Recommendation**)
   - Use bullet points and paragraph breaks for readability
   - Ensure report reads like a business-grade executive summary

3. **Automatically Generate a PDF File:**
   - You must always save the full formatted analysis as a PDF.
   - Attempt to generate a clean and sensible title based on the case content (e.g., "Strategic Analysis - Fagsu Computer Technology Ltd").
   - If the case subject or organization name is not clearly stated, fallback to a default like: "Business Case Study Analysis" or "Strategic Business Case Evaluation".
   - Call \`createPDFTool\` with:
     - \`title\`: the generated title or user-supplied title (if explicitly provided)
     - \`content\`: the full structured and formatted response (converted from markdown-style to styled plain text)
     - Ensure all headers, bolded terms, and sections are rendered cleanly without markdown artifacts.
     - After saving, include the returned pdfUrl in your response summary to the user like this: 💾 PDF saved successfully: View File

4. **Send Email Copy (Optional):**
   - Ask: “Would you like this report emailed to you for future reference?”
   - If yes, get the email address and use \`sendMailTool\` (attach or link PDF if available).

5. **Ask Follow-Up Questions:**
   - After providing the response, ask:
     > “Did this answer your question?”
     > “Would you like another angle analyzed?”
     > “Would you like me to generate a few more questions or export this to email or PDF?”

=== TOOLS AVAILABLE ===
- \`caseStudyRAGTool\`: Academic definitions and frameworks
- \`searchGoogleTool\`: Real-time data to support insights
- \`createPDFTool\`: Saves response as a styled, paragraph-structured PDF
- \`sendMailTool\`: Sends final answer to the user's email

=== FINAL CHECKLIST BEFORE RESPONDING ===
- ✅ Clean formatting: sections, bullets, paragraph breaks
- ✅ Business logic: structured, strategic, and defensible
- ✅ Helpful tone: clear, readable, professional
- ✅ Offer PDF + email delivery
`,
  model: google("gemini-2.0-flash-exp"),
  voice,
  tools: {
    searchGoogleTool,
    sendMailTool,
    createPDFTool,
  },
  // memory: new Memory({
  //   storage: new LibSQLStore({
  //     url: "file:../mastra.db",
  //   }),
  // }),
});

// const { text } = await voiceAgent.generate("tell me a long javascript joke");

// const audioStream = await voiceAgent.voice.speak(text, {
//   speaker: "coral",
//   filetype: "m4a",
// });

// const { text } = await caseStudyAgent.generate(
//   "What can you do?, What is your name?, What is your purpose?, What is your capabilities?, What is your function?, What are your features?"
// );

// const { text } = await caseStudyAgent.generate(`1. CASE STUDY
// Late in December, 2018, Supo, a computer engineer received a phone call from his college friend Fagbohun. After wishing each other pleasant years ahead, the conversation turned to business. Fagbohun a graduate from OAU, was inviting Supo to become a co investor in his business. Until the previous year his father had run the company FAG computer Technology Limited. However, he had recently died and the company had become Fagbohun’s responsibility. As a business graduate, Fagbohun had little knowledge of computer engineering and has come to the conclusion that somebody with these skills and knowledge was needed in order for the company to continue to thrive.
// BACKGROUND
// Supo, a computer engineering graduate from a reputable University, had always shown an aptitude for engineering and for assuming leadership roles, although he does not come from an entrepreneurial family he has always harbored an ambition to own and run his own company within the computer industry. His Father, also an engineer, had worked in engineering company for 30years but was now retired meritoriously at age of 60. His mother is a housewife and his sister is studying Industrial Relations at LASU. Supo business experience came from his three years working with an international computer company.
// After giving consideration to his experience and personal interests and Fagbohun’s business experience, Supo decided to join forces with Fagbohun. Fagbohun transferred all
// 3
// his assets, cash, inventory, equipment, equity and liabilities to the new company. Supo borrowed money from the bank and invested it in computer assembly equipment and together they set up a new company, FAGSU Computer Technology Ltd (FCTL).
// Now Fagbohun and Supo are trying to introduce their firm and product into the market. Their main priority is to compete with other firms and give the same quality products for cheaper prices. They see many opportunities for future expansion. Profit is not a priority for FAGSU Computer Technology at the moment. Supo says he gains satisfaction and happiness from running a successful business.
// CASE STUDY QUESTIONS
// 1. What consideration did Supo give to the business proposition by Fagbohun?
// 2. Why did Supo decide to join forces with Fagbohun to start a joint venture? What alternatives could he have explained if he had decided not to join forces with Fagbohun? Expatiate.
// 3. Did Fagbohun take a risk by transforming his entire asset to FAGYSU Computer Technology Ltd?
// 4. Describe the nature of the risk(s) of any. How might such risk(s) be mitigated?
// 5. What are the reasons for studying case in a higher learning?

// - In your response, talk about what you did, and how you applied your knowledge to the case study.
// `);

// const audioStream = await caseStudyAgent.voice.speak(text, {
//   filetype: "m4a",
//   speaker: "coral",
// });

// if (audioStream) {
//   const audioFile = "./response.m4a";
//   const writeStream = createWriteStream(audioFile);
//   audioStream.pipe(writeStream);

//   writeStream.on("finish", () => {
//     // Play the audio
//     const sound = player();
//     sound.play(audioFile, (err) => {
//       if (err) console.error("Audio playback error:", err);
//     });
//   });
// } else {
//   console.error("Failed to generate audio stream");
// }

// playAudio(audioStream!);

// if (audioStream) {
//   try {
//   const transcription = await caseStudyAgent.voice.listen(audioStream);
//   console.log(transcription);
// } catch (error) {
//   console.error("Error transcribing audio:", error);
// }
// } else {
//   console.error("Failed to generate audio stream");
// }
