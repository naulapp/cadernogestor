# O que você precisa fazer (deploy completo — sem Sprint 6)

Este arquivo é o **roteiro único**: Cloudflare R2 + Worker + secrets, GitHub Pages, Firebase, e **quais pastas/arquivos** mandar para o GitHub.

---

## A) O que enviar para o GitHub (sempre a raiz do site)

Faça commit e push de **tudo que está no repositório do app**, em especial:

| Caminho | Para quê |
|--------|----------|
| `index.html`, `core.js`, `operations.js`, `extras.js`, `styles.css` (se existir), `sw.js`, `README.md` | App admin |
| `ponto-crypto.js`, `ponto-admin.js`, `ponto-motor.js`, `almoxarifado.js`, `admin-scale.js`, `jornada-*.js` | Ponto, folha, jornada, almox |
| `ponto/` (pasta inteira: `index.html`, `app.js`, `sw.js`, `manifest.json`) | PWA do funcionário em `/ponto/` |
| `REGRAS FIRESTORE.txt` | Só referência — você copia no Console Firebase |
| `worker/` (código fonte: `src/`, `wrangler.toml`, `package.json`) | Deploy do Worker **não** é pelo GitHub Pages; é pelo Wrangler na sua máquina |

**Não commite** (use `.gitignore` ou não adicione):

- `worker/node_modules/`
- Arquivo JSON da **conta de serviço** do Firebase (chave privada)
- Qualquer cópia de `SESSION_SECRET` ou `FIREBASE_SERVICE_ACCOUNT` em arquivo de texto no repo

---

## B) Firebase (você já atualizou as regras)

1. **Firestore → Regras**  
   Manter publicado o conteúdo de `REGRAS FIRESTORE.txt` (coleções `marcacoesPonto`, `almoxItens`, etc.).

2. **Conta de serviço (obrigatória para o Worker)**  
   - Console Firebase → ícone engrenagem → **Contas de serviço** → **Gerar nova chave privada** → baixa um `.json`.  
   - Esse JSON inteiro será o secret `FIREBASE_SERVICE_ACCOUNT` no Cloudflare (veja seção D).  
   - A conta precisa de permissão para **ler/escrever Firestore** no projeto (papel *Editor* ou *Firebase Admin* / *Cloud Datastore User* conforme sua política de IAM no Google Cloud).

3. **Authentication**  
   Continua só para o **app admin** (e-mail/Google). O PWA do ponto **não** usa login Firebase no celular; ele usa o Worker.

---

## C) Cloudflare R2 (bucket de fotos)

1. Acesse [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2 Object Storage**.  
2. **Create bucket**.  
3. Nome sugerido: `cadernogestor-ponto` (se usar outro nome, edite `worker/wrangler.toml` → `bucket_name = "..."`).  
4. Anote o **nome exato** do bucket (vai no `wrangler.toml`).

Não é obrigatório tornar o bucket público: o Worker grava e só o Worker precisa acessar o R2.

---

## D) Cloudflare Worker + secrets (no seu PC)

### D.1 Ferramentas

1. Instale [Node.js](https://nodejs.org/) (LTS).  
2. Abra o PowerShell na pasta do projeto e entre na pasta do Worker:

```powershell
cd "H:\Meu Drive\AREA DE TRABALHO LJ\cadernogestor-main\worker"
```

(Reajuste o caminho se o projeto estiver em outro lugar.)

3. Instale dependências (recomendado fora do Google Drive se der erro de permissão):

```powershell
npm install
```

Se `npm install` falhar no Drive, copie a pasta `worker` para `C:\dev\cadernogestor-worker`, rode `npm install` lá e use `wrangler deploy` nessa cópia (o código é o mesmo).

4. Login Cloudflare:

```powershell
npx wrangler login
```

### D.2 Ajustar `wrangler.toml`

- Confirme `name = "cadernogestor-ponto"` (ou outro nome; será parte da URL `*.workers.dev` na primeira vez).  
- Confirme `bucket_name` igual ao bucket R2 que você criou.

### D.3 Secret `FIREBASE_SERVICE_ACCOUNT`

O valor deve ser o **JSON inteiro em uma linha** (string). No PowerShell, o jeito mais seguro é ler de um arquivo que **não** vai para o Git:

1. Salve o JSON do Firebase como `C:\temp\firebase-sa.json` (exemplo).  
2. Rode:

```powershell
Get-Content -Raw "C:\temp\firebase-sa.json" | npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
```

Cole confirmação se o Wrangler pedir. Apague o arquivo depois se quiser.

### D.4 Secret `SESSION_SECRET`

Gere uma chave aleatória (32+ bytes em base64) e grave como secret:

**PowerShell:**

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

Copie o resultado e:

```powershell
npx wrangler secret put SESSION_SECRET
```

Cole o valor quando pedido.

### D.5 Deploy

```powershell
npx wrangler deploy
```

No final aparece a URL pública, por exemplo:

`https://cadernogestor-ponto.<subdomínio>.workers.dev`

### D.6 CORS (opcional)

No `worker/wrangler.toml`, `[vars]` → `ALLOWED_ORIGIN`:

- `*` = qualquer site pode chamar a API (simples para testar).  
- Para produção, coloque a URL exata do seu GitHub Pages, **sem** barra no final, por exemplo:  
  `https://seuusuario.github.io`

Depois de mudar `[vars]`, rode `npx wrangler deploy` de novo.

---

## E) No app admin (depois do Worker no ar)

1. **Configurações → Ponto eletrônico**  
   - Cole em **URL base do Worker** a URL do passo D.5 (sem barra no final).  
   - Salve também **código da empresa**, geo, foto obrigatória, etc.

2. **Funcionários**  
   - CPF com 11 dígitos.  
   - **Gerar PIN** e enviar o **link** (ele já inclui `&w=` com a URL do Worker quando configurada).

3. Teste no celular: abrir o link → informar PIN (e CPF só se abrir sem `t=` na URL) → **Registrar batida**.

4. No admin: **Ponto (gestão)** deve listar a marcação; no Cloudflare R2 aparecem objetos sob `orgs/.../ponto/...`.

---

## F) Folha de pagamento (Sprints 4 e 5 no app)

1. **Folha de Pagamento** → escolha mês/ano → **Carregar funcionários**.  
2. **Puxar do ponto** preenche `horas extras`, `dias trabalhados` e `faltas` com base nas **marcações** + **jornada/política/feriados**.  
   - Só entram no cálculo automático funcionários com **PIN já gerado** (`pontoPinHash`).  
3. **Travar importação do ponto (AAAA-MM)** impede novo “Puxar do ponto” naquele mês (campo `pontoMesesFechados` no documento da org).  
4. Revise sempre com seu contador antes de fechar folha.

---

## G) Checklist rápido

- [ ] Push no GitHub com pasta `ponto/` e JS atualizados.  
- [ ] GitHub Pages atualizado (site abre `/ponto/`).  
- [ ] Bucket R2 criado e `wrangler.toml` com o nome certo.  
- [ ] `wrangler secret put FIREBASE_SERVICE_ACCOUNT` e `SESSION_SECRET`.  
- [ ] `wrangler deploy` concluído.  
- [ ] URL do Worker salva no admin.  
- [ ] Teste: 1 batida real + aparece em **Ponto (gestão)**.

---

## H) Problemas comuns

| Sintoma | O que verificar |
|--------|------------------|
| `FIREBASE_SERVICE_ACCOUNT não configurado` | Secret não foi criado ou nome errado. |
| `R2 (PONTO_BUCKET) não ligado` | `wrangler.toml` sem `[[r2_buckets]]` ou nome do bucket errado; rode deploy de novo. |
| `permission-denied` no admin | Regras Firestore antigas. |
| Login ponto `Código inválido` | `pontoCodigo` da org não bate com o `c` na URL (maiúsculas). |
| `PIN incorreto` | Gerar PIN de novo no admin. |
| CORS no navegador | Ajuste `ALLOWED_ORIGIN` ou use `*` temporariamente. |
| `npm install` com `EBADF` / `TAR_ENTRY_ERROR` / `EPERM` na pasta do projeto | O projeto está em **Google Drive** (ou outro disco sincronizado). Copie só a pasta `worker` para um caminho local, ex. `C:\dev\cadernogestor-worker`, e rode `npm install` e `wrangler` **lá**. Alternativa: na pasta `worker` use `npx wrangler deploy` (baixa o Wrangler no cache do npm) sem depender de `node_modules` estável no Drive. |

---

Sprint 6 (SaaS / mensalidade) continua **fora** deste guia até você pedir.
