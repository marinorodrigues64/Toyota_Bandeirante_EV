# Backend – Plano de Conversão Toyota Bandeirante

Função serverless que guarda a chave da API da Anthropic no servidor e faz a
chamada em nome do formulário HTML, evitando expor a chave no navegador.

## Estrutura

```
backend/
  api/
    gerar-plano.js   ← endpoint POST /api/gerar-plano
  package.json
  .env.example
```

## Deploy no Vercel (recomendado — gratuito para esse uso)

1. Crie uma conta em https://vercel.com (pode entrar com GitHub).
2. Instale a CLI (opcional, mas mais rápido):
   ```
   npm i -g vercel
   ```
3. Dentro da pasta `backend/`, rode:
   ```
   vercel
   ```
   Siga as perguntas (aceite os padrões). Isso cria o projeto e te dá uma URL,
   por exemplo: `https://toyota-bandeirante-backend.vercel.app`.
4. Configure a variável de ambiente com sua chave da Anthropic:
   ```
   vercel env add ANTHROPIC_API_KEY
   ```
   (ou pelo painel web: Project → Settings → Environment Variables)
5. Faça o deploy de produção:
   ```
   vercel --prod
   ```
6. Seu endpoint final será:
   ```
   https://SEU-PROJETO.vercel.app/api/gerar-plano
   ```

### Alternativa sem CLI

Suba a pasta `backend/` para um repositório no GitHub e conecte o repositório
diretamente pelo painel do Vercel ("Add New Project" → importar do GitHub).
Configure a variável `ANTHROPIC_API_KEY` na mesma tela antes do primeiro
deploy.

## Deploy em outra plataforma

O arquivo `api/gerar-plano.js` é uma função Node simples (`module.exports =
async (req, res) => {...}`), no formato esperado pelo Vercel. Para usar em
Netlify Functions, AWS Lambda ou Cloudflare Workers, é preciso adaptar a
assinatura da função ao formato de cada plataforma — a lógica interna (montar
o prompt, chamar `api.anthropic.com/v1/messages`, devolver `{ plano: "..." }`)
permanece a mesma.

## Testando localmente

```
npm i -g vercel
cp .env.example .env   # e edite com sua chave
vercel dev
```

O endpoint ficará disponível em `http://localhost:3000/api/gerar-plano`.

## Depois do deploy

Abra o arquivo `toyota-bandeirante.html` e atualize a constante
`BACKEND_URL` no topo do `<script>` para a URL do seu endpoint, por exemplo:

```js
const BACKEND_URL = "https://SEU-PROJETO.vercel.app/api/gerar-plano";
```

Salve e o botão "Gerar Plano de Conversão" passará a funcionar também fora
do Claude.ai.
