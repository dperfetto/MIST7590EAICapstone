const allowedTypes = new Set(["SaaS", "Professional Services", "DPA"]);

async function verifyUser(req) {
  const auth = req.headers.authorization;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!auth?.startsWith("Bearer ") || !url || !key) return false;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { authorization: auth, apikey: key },
  });
  return response.ok;
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  if (!(await verifyUser(req)))
    return res.status(401).json({ error: "Authenticated reviewer required" });
  if (!process.env.OPENAI_API_KEY)
    return res.status(503).json({ error: "AI analysis is disabled" });
  const { text, agreementType, playbook = [] } = req.body ?? {};
  if (
    !allowedTypes.has(agreementType) ||
    typeof text !== "string" ||
    text.length < 40
  )
    return res
      .status(400)
      .json({ error: "Valid agreement text and type are required" });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "You extract contract facts for human review. Never give legal advice or silently approve an agreement. Return only evidence-supported findings. Distinguish not detected from absent.",
        },
        {
          role: "user",
          content: `Agreement type: ${agreementType}\nActive playbook rules: ${JSON.stringify(playbook).slice(0, 20000)}\n\nIdentify relevant playbook gaps, deviations, and acceptable provisions. Every finding must quote supporting source text and include confidence 0-100.\n\n${text}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "contract_findings",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["findings"],
            properties: {
              findings: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "provision",
                    "findingType",
                    "severity",
                    "confidence",
                    "sourceText",
                    "reason",
                    "analysisMethod",
                  ],
                  properties: {
                    provision: { type: "string" },
                    findingType: {
                      type: "string",
                      enum: ["gap", "deviation", "acceptable"],
                    },
                    severity: {
                      type: "string",
                      enum: ["low", "medium", "high", "critical"],
                    },
                    confidence: { type: "integer", minimum: 0, maximum: 100 },
                    sourceText: { type: "string" },
                    reason: { type: "string" },
                    analysisMethod: { type: "string", enum: ["ai"] },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });
  if (!response.ok)
    return res.status(503).json({ error: "AI provider unavailable" });
  const result = await response.json();
  const outputText =
    result.output_text ||
    result.output
      ?.flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text")?.text;
  try {
    return res.status(200).json(JSON.parse(outputText));
  } catch {
    return res
      .status(502)
      .json({ error: "AI response could not be validated" });
  }
}
