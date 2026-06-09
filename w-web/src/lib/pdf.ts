import jsPDF from "jspdf"; // biblioteca para gerar PDF
import autoTable from "jspdf-autotable"; // cria tabelas no PDF
import { format } from "date-fns"; // formata datas
import { ptBR } from "date-fns/locale"; // localização pt-BR
import { getEvents, ADMIN_ID } from "@/lib/storage"; // pega eventos e id do admin
import type { ActivityEntry } from "@/lib/realtime"; // tipagem das atividades

export function exportAdminDayReport(date: Date, activity: ActivityEntry[]) { // função exportar relatório
  const doc = new jsPDF(); // cria documento PDF
  const dateLabel = format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }); // data formatada bonita
  const dateKey = format(date, "yyyy-MM-dd"); // data padrão banco/chave

  doc.setFontSize(16); // tamanho fonte
  doc.text("Waekium ERP — Relatório do Administrador", 14, 18); // título PDF
  doc.setFontSize(10); // muda tamanho fonte
  doc.setTextColor(100); // muda cor texto
  doc.text(dateLabel, 14, 25); // escreve data

  // Agenda
  const events = getEvents(ADMIN_ID, date); // pega eventos do admin
  doc.setTextColor(0); // volta texto preto
  doc.setFontSize(12); // tamanho fonte
  doc.text("Agenda do dia", 14, 36); // título seção agenda

  autoTable(doc, { // cria tabela
    startY: 40, // posição inicial vertical
    head: [["Horário", "Título", "Descrição", "Tag"]], // cabeçalho tabela

    body: events.length // verifica se existem eventos
      ? events.map((e) => [e.time, e.title, e.description ?? "—", e.tag ?? "—"]) // lista eventos
      : [["—", "Sem eventos cadastrados", "", ""]], // mensagem sem eventos

    styles: { fontSize: 9 }, // estilo tabela
    headStyles: { fillColor: [30, 30, 30] }, // cor cabeçalho
  });

  // Histórico de entregas
  const dayActivity = activity.filter((a) => a.date === dateKey); // filtra atividades do dia

  type AutoTableDocument = typeof doc & { lastAutoTable?: { finalY: number } };
  const afterAgenda = (doc as AutoTableDocument).lastAutoTable?.finalY ?? 60; // pega posição final tabela

  doc.setFontSize(12); // tamanho fonte
  doc.text("Histórico de entregas e ações", 14, afterAgenda + 12); // título histórico

  autoTable(doc, { // nova tabela
    startY: afterAgenda + 16, // posição abaixo da tabela anterior
    head: [["Hora", "Tipo", "Descrição"]], // cabeçalho

    body: dayActivity.length // verifica se existem atividades
      ? dayActivity.map((a) => [a.time, kindLabel(a.kind), a.message]) // lista atividades
      : [["—", "—", "Sem registros no dia"]], // mensagem vazia

    styles: { fontSize: 9 }, // estilo tabela
    headStyles: { fillColor: [30, 30, 30] }, // cor cabeçalho
  });

  doc.save(`waekium-relatorio-${dateKey}.pdf`); // salva PDF
}

function kindLabel(k: ActivityEntry["kind"]) { // converte tipo técnico em texto amigável
  switch (k) { // verifica tipo
    case "rota_iniciada": return "Rota iniciada"; // rota começou
    case "entrega_finalizada": return "Entrega finalizada"; // entrega concluída
    case "ponto": return "Ponto"; // registro ponto
    case "status": return "Status"; // mudança status
  }
}
