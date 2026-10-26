# Plano de melhoria do EditPDF

1. Persistir arquivos e metadados em IndexedDB; migrar a biblioteca existente sem inventar arquivos ausentes; serializar gravações e mostrar falhas.
2. Isolar histórico por documento, incluir o estado inicial e registrar um movimento como uma única ação.
3. Abrir em leitura, ajustar página à tela e oferecer ferramentas com nomes claros, alvos de toque grandes e painéis sobrepostos no celular.
4. Selecionar texto extraído do PDF para correções locais com editor de bloco, quebra de linha, formatação e aviso de excesso. Esta modalidade é uma correção visual, não remoção do conteúdo original.
5. Adicionar modo Documento com editor de parágrafos, listas, imagens, alinhamento e exportação de novo PDF com fluxo/paginação. Conversão é explícita, preserva o PDF original e explica perda de layout e imagens originais.
6. Melhorar toque, mover/redimensionar anotações e exportar com geometria coerente; remover atalhos específicos de demonstração da interface normal.
7. Validar persistência, histórico, texto e exportação com testes unitários e navegador em viewport móvel. Gerar APK pela CI e documentar o que ainda exige aparelho físico.
8. Edição fiel de objetos originais e remoção segura de conteúdo dependem da escolha de motor/licença. Não apresentar cobertura branca como remoção real. OCR e reconstrução fiel de PDFs complexos não estão resolvidos por PDF.js/pdf-lib.

## Execução

As etapas 1–7 foram implementadas com as restrições da etapa 8. O modo Documento usa Tiptap/pdfmake; correções locais no PDF continuam explícitas como sobreposição, conforme a escolha do usuário por ferramentas permissivas. A cobertura de testes inclui recuperação de binários, primeiro desfazer, isolamento do histórico, correção textual, paginação, exportação e gestos. Android físico permanece uma validação manual.
