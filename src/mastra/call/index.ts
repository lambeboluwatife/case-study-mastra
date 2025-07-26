import Arcade from "@arcadeai/arcadejs";

const USER_ID = process.env.USER_ID;

export const sendMail = async ({ toolInput }) => {
  const client = new Arcade();

  const auth = await client.tools.authorize({
    tool_name: "Gmail.SendEmail@3.0.0",
    user_id: USER_ID,
  });

  if (auth?.status !== "completed") {
    console.log(`Click here to authorize the tool: ${auth?.url}`);
  }

  const { status } = await client.auth.waitForCompletion(auth);

  if (status !== "completed") {
    throw new Error("Authorization failed");
  }

  console.log("🚀 Authorization successful!");

  const result = await client.tools.execute({
    tool_name: "Gmail.SendEmail@3.0.0",
    input: {
      starred: "true",
      subject: toolInput.subject,
      body: toolInput.body,
      recipient: toolInput.recipient,
    },
    user_id: USER_ID,
  });

  return result;
};

export const searchGoogle = async ({ toolInput }) => {
  const client = new Arcade();

  const result = await client.tools.execute({
    tool_name: "GoogleSearch.Search@3.0.0",
    input: {
      owner: "ArcadeAI",
      name: "arcade-ai",
      starred: "true",
      query: toolInput.query,
      n_results: toolInput.n_results || 5,
    },
    user_id: USER_ID,
  });

  return result;
};
