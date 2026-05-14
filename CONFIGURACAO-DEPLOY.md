# Configuração e deploy (CadernoGestor — Ponto + Cloudflare)

Este guia é **a sua parte** depois que o código já estiver no ar. O Sprint 6 (vender SaaS) fica **fora** por enquanto, conforme combinado.

---

## 1) Firebase (já em uso)

1. **Firestore — regras**  
   Copie o conteúdo atualizado de `REGRAS FIRESTORE.txt` para o Console do Firebase → Firestore → **Regras** → Publicar.  
   Inclui: `jornadaSettings`, `politicaJornada`, `feriados`, `marcacoesPonto`, `almoxItens`, `almoxMovimentos`.

2. **Authentication**  
   Continua como hoje (e-mail/Google). O app de ponto usará **Custom Token** gerado pelo Worker (Sprint 3).

3. **Conta de serviço (para o Worker)** — quando for ativar o ponto mobile  
   - Console → Configurações do projeto → **Contas de serviço** → Gerar nova chave privada → JSON.  
   - Guarde com segurança. Você vai colar o conteúdo (ou partes) nos **secrets** do Cloudflare Worker (não commite no Git).

---

## 2) GitHub Pages (seu site atual)

- O PWA do ponto fica em **`/ponto/`** (pasta `ponto/` no repositório).  
- O link gerado no cadastro do funcionário aponta para:  
  `.../ponto/?c=CÓDIGO&t=TOKEN`

Após cada deploy, force atualização no celular (fechar aba / limpar cache) se o `sw.js` tiver mudado.

---

## 3) Cloudflare — R2 + Worker (Sprint 3 — quando formos fechar o app de ponto)

### R2

1. Cloudflare Dashboard → **R2** → Criar bucket (ex.: `cadernogestor-ponto`).  
2. Anote o **nome do bucket** e o **Account ID**.

### Worker

1. Instale Wrangler (`npm i -g wrangler`) no PC e faça login (`wrangler login`).  
2. Na pasta `worker/` do projeto (quando estiver completa), configure `wrangler.toml` com o binding R2.  
3. **Secrets** típicos (nomes sugeridos — o código final dirá os exatos):  
   - `FIREBASE_SERVICE_ACCOUNT` — JSON da conta de serviço (string inteira) **ou** variáveis separadas (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).  
4. Deploy: `wrangler deploy`

### URL no sistema

Em **Configurações → Ponto eletrônico → URL base do Worker**, cole a URL pública do Worker (ex.: `https://cadernogestor-ponto.xxxxx.workers.dev`).

---

## 4) O que já funciona no app (admin)

| Recurso | Onde |
|--------|------|
| Código da empresa, foto obrigatória, geo, batidas/dia, URL Worker | **Configurações → Ponto eletrônico** |
| PIN + link do funcionário | **Funcionários → editar → Ponto eletrônico** |
| Lista de marcações (quando existirem) | **Ponto (gestão)** |
| Jornada / política / feriados | **Jornada e política** |
| Almoxarifado | **Gestão → Almoxarifado** |

---

## 5) Sprints 4 e 5 (motor de fechamento + folha) — estado

- **Sprint 4** (cálculo mensal de horas, faltas, abonos, DSR conforme política): **em evolução** — depende de marcações reais e de validação com seu contador.  
- **Sprint 5** (preencher `horaExtra` na folha a partir do ponto, com edição manual): **em evolução** — liga ao motor da Sprint 4.

Quando essas partes estiverem codificadas, este documento será atualizado com telas e botões exatos.

---

## 6) Checklist rápido antes de liberar ponto para funcionários

- [ ] Regras Firestore publicadas  
- [ ] Código da empresa salvo em Configurações  
- [ ] Cada funcionário com CPF válido + PIN gerado  
- [ ] Worker deployado + URL salva  
- [ ] Testar uma batida de teste (após o PWA completo)  
- [ ] Conferir **Ponto (gestão)** e foto no R2 (quando existir)

---

Dúvidas na implementação do Worker/R2: diga qual etapa travou (Wrangler, secret, CORS, domínio) que ajustamos o código ou o passo a passo.
