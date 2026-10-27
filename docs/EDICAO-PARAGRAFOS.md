# Edição de parágrafos — segunda etapa

## O que mudou

1. **Seleção por parágrafo:** linhas do mesmo bloco, direção e estilo são agrupadas. O modo **Trechos** continua disponível para correções pontuais. Títulos, colunas e estilos distintos não são unidos indiscriminadamente.
2. **Texto com várias linhas:** o editor aceita Enter, linhas em branco, ajuste automático de palavras, alinhamento à esquerda/centro/direita, tamanho e cor. A área de edição e as entrelinhas podem ser ajustadas dentro da página.
3. **Conferência antes de aplicar:** o mesmo cálculo de layout é usado pela prévia e pela exportação. O motor verifica largura, altura e colisão com outros textos; não aplica conteúdo que não caiba. O ajuste automático reduz a fonte até 6 pt (ou o tamanho menor escolhido explicitamente), sem cortar palavras silenciosamente. A prévia opcional renderiza glifos com MuPDF, sem alterar o documento ou o histórico.
4. **Uso no celular:** os botões de aplicar/cancelar permanecem visíveis; rolagem de leitura não é reiniciada após uma alteração; pedidos de renderização são agrupados durante o zoom. A última página é salva por documento. A busca ignora acentos tanto na contagem quanto no destaque.
5. **Confiabilidade:** gravações de metadados/cópias são ordenadas; falha síncrona aborta a transação inteira. Se o armazenamento falhar, a edição permanece aberta e pode ser exportada antes de sair. As edições por parágrafo continuam participando do histórico do MuPDF, inclusive depois de salvar.

## Continuidade da edição

O PDF exportado recebe somente informações geométricas dos blocos editados (área, posição das linhas, entrelinhas, alinhamento e separadores de linha). Isso permite selecionar novamente um parágrafo centralizado ou com linhas em branco após reabrir. Essa informação não armazena cópias do texto apagado. Ferramentas externas que removam esses dados podem fazer a detecção voltar à estrutura nativa do PDF.

## Limites

- O texto é redistribuído dentro de um bloco da página. Ainda não há fluxo automático que empurre os próximos parágrafos para outra página.
- A detecção respeita o estilo e a estrutura encontrada no PDF. Um parágrafo com estilos misturados pode aparecer como trechos menores para preservar formatação e conteúdo.
- Expansão da área não move o conteúdo vizinho; a alteração é bloqueada se o novo texto o cobrir.
- OCR, texto vertical/rotações complexas, desenho vetorial individual e imagens sobrepostas mantêm os limites da etapa anterior.
- Fontes embutidas são reutilizadas quando possível. Caso contrário, o editor informa o uso de fonte equivalente.
- Textos digitados mantêm Enter e linhas em branco. Nas linhas detectadas do arquivo original, as quebras físicas são tratadas como quebras automáticas de linha.

## Verificação

Testes cobrem substituição de múltiplas linhas com remoção real do texto antigo, preservação de fundo e vizinhos, alinhamento, inserção/exclusão, Unicode/palavras longas, prévia sem mutação, overflow e colisões, histórico após exportar, reabertura com parágrafos/linhas em branco, leitura na última página, rolagem e recuperação por exportação quando não há espaço para salvar. A interface é testada em viewport móvel; a validação em aparelho físico continua necessária.

Resultado local: **29 testes de conteúdo/armazenamento + 13 testes de navegador aprovados**, TypeScript e build de produção aprovados. Capturas do editor e da prévia foram inspecionadas em viewport móvel. O push na `main` aciona novamente a validação e a compilação do APK no GitHub Actions.
