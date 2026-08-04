// api/gerar-plano.js
//
// Função serverless (Vercel) que recebe o resumo do formulário da Toyota
// Bandeirante, monta o prompt com o "Prompt PME" e o "Plano Master (PMB)"
// já embutidos localmente (sem depender de nenhum link externo), chama a
// API da Anthropic usando a chave guardada no servidor (nunca exposta ao
// navegador) e devolve o texto do plano de conversão.
//
// Por que os documentos estão embutidos (e não buscados por link)?
// O Proton Drive exige JavaScript para carregar a página de compartilhamento,
// e a ferramenta de busca da API não consegue executar JavaScript — ela
// sempre recebia uma página vazia. Isso fazia o Claude "chutar" um relatório
// genérico, e ainda cobrava pelas tentativas de busca. Embutir o conteúdo
// real resolve os dois problemas de uma vez: qualidade e custo.

const fs = require("fs");
const path = require("path");

const ALLOWED_ORIGIN = "*"; // restrinja ao seu domínio, se quiser

// Lê os dois documentos uma única vez (fora do handler), para não reler
// disco a cada chamada.
const PROMPT_PME_TEXT = fs.readFileSync(
  path.join(__dirname, "data", "prompt-pme.txt"),
  "utf-8"
);
const PMB_TEXT = fs.readFileSync(
  path.join(__dirname, "data", "documento-base.txt"),
  "utf-8"
);

// Ajuste de formato: o "Prompt PME" original pede saída em .PDF. A API de
// texto não gera um arquivo PDF binário — então pedimos aqui, explicitamente,
// que o mesmo conteúdo/estrutura seja entregue em Markdown bem formatado
// (títulos, tabelas, listas), que é o que o formulário consegue exibir e
// baixar. Se quiser um PDF de verdade depois, dá para converter o Markdown
// resultante separadamente.
const AJUSTE_FORMATO = `\n\nAJUSTE DE FORMATO DE ENTREGA (sobrepõe a instrução "FORMATO DA RESPOSTA" acima):
Entregue o documento em Markdown puro (títulos com #, tabelas em formato Markdown, listas com "-"), não em PDF. Mantenha toda a estrutura de capítulos, a matriz de decisão final e a matriz de rastreabilidade exatamente como especificado.`;

const SYSTEM_PROMPT = PROMPT_PME_TEXT +
  AJUSTE_FORMATO +
  "\n\n=== PLANO MASTER DE ELETRIFICAÇÃO (PMB) — BASE DE CONHECIMENTO OBRIGATÓRIA ===\n\n" +
  PMB_TEXT;

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

    const userMessage = `Aqui está o resumo do veículo, coletado via formulário "Informações da Toyota Bandeirante":

${resumo}

Execute as 5 etapas definidas no seu papel (Levantamento, Validação, Análise de Compatibilidade, Geração do Plano Master Específico e conclusão) e gere o Plano Master Específico (PME) completo para este veículo, seguindo rigorosamente a estrutura de capítulos definida.`;

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            // Marca o PMB + Prompt PME (conteúdo estático, grande) como
            // cacheável. Na primeira chamada custa um pouco mais (escrita
            // de cache); nas chamadas seguintes, dentro da janela de cache,
            // esse bloco custa ~90% menos.
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userMessage }],
        // Sem "tools": nada de web_search. Não precisamos mais buscar nada
        // na internet — os documentos já estão embutidos acima.
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

    // Se o Claude foi cortado por atingir o limite de tokens, avisamos no
    // próprio documento para não parecer um erro silencioso.
    const truncado = data.stop_reason === "max_tokens";
    const aviso = truncado
      ? "\n\n---\n⚠ ATENÇÃO: este documento pode ter sido cortado por atingir o limite de tokens de saída. Se faltar conteúdo no final, aumente 'max_tokens' em api/gerar-plano.js e gere novamente.\n"
      : "";

    res.status(200).json({
      plano: planoTexto + aviso,
      usage: data.usage || null, // útil para acompanhar consumo de tokens
    });
  } catch (err) {
    console.error("Erro inesperado:", err);
    res.status(500).json({ error: "Erro inesperado no servidor.", detail: String(err) });
  }
};
