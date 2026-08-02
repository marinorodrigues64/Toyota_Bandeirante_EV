// api/gerar-plano.js
// Função serverless (Vercel) que recebe o resumo do formulário da Toyota
// Bandeirante, chama a API da Anthropic usando a chave guardada no servidor
// (nunca exposta ao navegador) e devolve o texto do plano de conversão.

const DOC_BASE_URL = "https://drive.proton.me/urls/JQEG1ZRM8W#wuaoWJ8ZVpOa";
const PROMPT_URL = "https://drive.proton.me/urls/7X2RX1M4FW#9743AkMTuJro";

// Ajuste aqui se quiser restringir quem pode chamar este endpoint
// (ex.: o domínio onde o formulário está hospedado).
const ALLOWED_ORIGIN = "*";

module.exports = async (req, res) => {
  // CORS básico
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido. Use POST." });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada no servidor." });
    return;
  }

  try {
    const { resumo } = req.body || {};
    if (!resumo || typeof resumo !== "string") {
      res.status(400).json({ error: "Campo 'resumo' ausente ou inválido no corpo da requisição." });
      return;
    }

    const promptParaClaude = `Você deve gerar um plano específico de conversão elétrica para uma Toyota Bandeirante, usando as informações abaixo.

Primeiro, acesse e leia estes dois documentos públicos:
1. Documento base (especificações técnicas de referência): ${DOC_BASE_URL}
2. Prompt / roteiro de elaboração do plano: ${PROMPT_URL}

Em seguida, execute exatamente o que o "Prompt Claude" indicar, aplicando-o aos dados do veículo abaixo (coletados via formulário "Informações da Toyota Bandeirante"):

${resumo}

Gere o documento final do plano de conversão em português, pronto para ser entregue ao proprietário do veículo. Responda apenas com o conteúdo do documento (sem comentários adicionais fora do documento).`;

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{ role: "user", content: promptParaClaude }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error("Erro da API Anthropic:", anthropicResponse.status, errText);
      res.status(502).json({ error: "Falha ao chamar a API da Anthropic.", detail: errText });
      return;
    }

    const data = await anthropicResponse.json();
    const planoTexto = (data.content || [])
      .map((block) => (block.type === "text" ? block.text : ""))
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (!planoTexto) {
      res.status(502).json({ error: "Resposta vazia do Claude." });
      return;
    }

    res.status(200).json({ plano: planoTexto });
  } catch (err) {
    console.error("Erro inesperado:", err);
    res.status(500).json({ error: "Erro inesperado no servidor.", detail: String(err) });
  }
};
