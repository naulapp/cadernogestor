# 📒 CadernoGestor

PWA de gestão de folha de pagamento, empréstimos e acertos mútuos.

---

## 🚀 Como colocar no ar (GitHub Pages)

### 1. Criar repositório
```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/naulapp/cadernogestor.git
git push -u origin main
```

### 2. Ativar GitHub Pages
- Settings → Pages → Source: `main` / `root`
- URL será: `https://naulapp.github.io/cadernogestor`

---

## 🔥 Configurar Firebase

### 1. Criar projeto
- Acesse https://console.firebase.google.com
- Crie projeto `cadernogestor`
- Ative **Authentication** (Email/Senha + Google)
- Ative **Firestore Database**

### 2. Obter credenciais
- Project Settings → Adicionar app Web
- Copie o `firebaseConfig`

### 3. Substituir no index.html
Encontre e substitua:
```js
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "cadernogestor.firebaseapp.com",
  projectId: "cadernogestor",
  ...
};
```

### 4. Regras do Firestore
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /orgs/{orgId} {
      allow read, write: if request.auth != null;
      match /{collection}/{docId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

---

## 📱 Funcionalidades

### ✅ Implementado
- Login Google + email/senha
- Criar/entrar em organização via código de convite
- Perfis: Gestor / Empregador / Funcionário
- Cadastro de funcionários (nome, CPF, cargo, salário)
- Grupos salariais (modelo aplicado a vários funcionários)
- Empréstimos parcelados com tracking de pagamento
- Vales avulsos (desconto integral)
- Folha de pagamento por mês/ano com edição individual
- Geração de PDF fiel ao modelo existente (com recibo)
- Geração de todos os PDFs em um arquivo só
- Acerto mútuo entre duas pessoas (saldo líquido em tempo real)
- Histórico de lançamentos do acerto mútuo
- Modo offline/demo (sem Firebase, usa localStorage)

### 🔜 Próximas versões
- Histórico de folhas salvas
- Notificações de parcela vencendo
- Exportar relatório geral em PDF
- Plano pago com Mercado Pago PIX
- Multi-empresa por usuário
- App stores (Play/App Store)

---

## 🎨 Stack

- HTML + CSS + JS puro (sem framework)
- Firebase Auth + Firestore
- jsPDF + jsPDF-AutoTable
- PWA (installable, offline-ready)

---

## 💡 Modo Demo

Sem Firebase configurado, o app funciona em modo demo:
- Dados salvos no `localStorage` do navegador
- Ideal para testar antes de configurar o Firebase
